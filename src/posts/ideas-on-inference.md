---
layout: post.njk
title: Ideas on type inference
description: TypeScript sans annotations
date: 2025-09-26
image: /media/banners/ideas-on-inference.png
tags: posts
---

In the third and final post of Ezno week, we will take a look at two kinds of type inference. One kind what I refer to as `forward` and the other as `backward`. One *implemented* and the other a *work-in-progress*.

The words inference in a type-checker refers to creating (or finding) a type **for a parameter** (or variable in some cases). Often because the annotation is elided (fancy compiler speak for missing). Inference is a subset of a more general term of *type synthesis*.

```typescript
//                          ↓ no annotation here
const y = [1, 2, 3].map(item => item)
//                          	 ↑ `item` *has* type `number` here
```

### Forward inference: pushing an annotation forwards

The first kind that I refer to forward is in partially annotated (or realised) source text. We have a function parameter **without an annotation** but we can figure *a type* out through looking at the context of where the containing function is written in.

> If you have read [the section on performance in the last post](/posts/specification-speed-schedule), you may have seen that TSC records a time for a `bind` pass but Ezno does not. I am not hiding that result, but infact the bind phase and check phase are merged in Ezno. Excluding the pass on top level declarations in a block used for [hoisting](https://developer.mozilla.org/en-US/docs/Glossary/Hoisting), the AST is only walked once (compared to twice in TSC *I think*).

This can happen with and without annotations. If we declare a function as the value of variable **that is annotated** we need to *push* the annotation forward

```typescript
//                                        ↓ no annotation here
const increment: (x: number) => number = x => x + 1;
//                      ↘----------------↗
//         we push the `number` parameter annotation forward
```

But we also have cases where the user source is not annotated. For example in `Promise.prototype.then`

```typescript
//                           ↓ no annotation here
fetch("...").then(function (res) {
//  using information about  ↓
//  what `fetch` returns     ↓
//  we can figure out that `res` is a `Response`
})
```

This is why I refer to it as *forward*. Using an annotation or other context we pass information forward in the source / buffer to figure out the *type* of the parameter.

#### The basics of the implementation

The implementation is quite simple, we pass an *expected type* through our `synthesise_expression` function.

```rust
fn synthesise_expression(
	expression: &ezno_parser::ast::Expression,
	// ↓
	expected_type: TypeId,
	// ↑
	environment: ..., 
	checking_data: ... etc
) -> TypeId
```

So in the above example, we pass the *resolved* type in the variable 

```rust
fn synthesise_variable_declaration(
	variable_declaration: &ezno_parser::ast::Expression,
	...
) {
	// ...
	let expected_type = synthesise_type_annotation(variable_declaration.type_annotation, /* ... */);
	let value = synthesise_expression(variable_declaration.expression, expected_type, /* ... */);
	// ...
}
```

We do this passing in several places

- Variable declarations pass their resolved annotation
- Function arguments pass there respective parameter type
- The resolved function return type annotation is stored in the environment and passed to the expression in `return` statements
- `satisfies` passes its RHS annotation to the LHS. (so technically not forwards. Another to add to my gripes on the `satisfies` operator 😩)
- Class declarations with an `implements` clause (`extends` is contraversial)

When we arrive at a function or method declaration **and** this type is a function, we pass the expected parameter types forward to `synthesise_function`. When synthesising parameters if we arrive at a parameter without an annotation, we can pick it from the expected parameter.

#### Forward inference on properties gives unexpected member warnings for free

We do some transformation and passing in some cases. For example on object literals we get the property on the expected type 

```typescript
const myobj: { mymethod: (p: string) => string } = {
	// we evaluate `{ mymethod: (p: string) => string }["mymethod"]` to get the
	// expected type of `(p: string) => string`. The un-annoted parameter `p` 
	// therefore has a type of `string`
	//       ↓
	mymethod(p ) {
		p // ← string
	}
}
```

After adding the inference here, I had an an idea about [how to add in the comment on an issue](https://github.com/kaleidawave/ezno/issues/42#issuecomment-2067326659).

Thanks to the work of [Patrick Laflamme](https://github.com/PatrickLaflamme) who implemented this in [PR #139](https://github.com/kaleidawave/ezno/pull/139) we can raise an early error for excess properties.

```rust
let property = environment.get_property(
	expected,
	Publicity::Public,
	&key,
	...
);

if property.is_none() {
	checking_data.diagnostics_container.add_warning(TypeCheckWarning::ExcessProperty { ... })
}
```

> [Currently implementation here](https://github.com/PatrickLaflamme/ezno/blob/854f5e832b7729580a3180935241c656f8b3d31f/checker/src/synthesis/expressions.rs#L1061-L1088)

---

There are several decisions we take for the expected type for different kinds of expressions.

- For assignments we use the constraint (variable or property type) on the LHS
- For conditionals we pass the expected type to both branches
- For object spreads we pass down the whole expected type

> The last two [assist in catching excess-property cases that for an unknown reason TypeScript doesn't catch](https://kaleidawave.github.io/ezno/comparison/#excesspropertychecksthroughspreadandcondition).

#### Complications

One of the problems is around generics. Sometimes we might have a parameter that is based on generics.

For example `addEventListener`, the second function parameter is based of the first argument.

```typescript
interface EventMap {
	"mousedown": MouseEvent
}

interface Node {
	addEventListener<T extends keyof EventMap>(name: T, cb: (ev: EventMap[T]) => void);
}
```

We can do this by specialising generics left-to-right before the next parameter. This is [and some more and currently unimplemented](https://github.com/kaleidawave/ezno/issues/236).

One neat example I forgot I got working is computed generics! [Here](https://kaleidawave.github.io/ezno/playground/?id=9fm77k) we get a union of the members, not just `number`. (more explanation in the future).

```typescript
const x = [1, 2, 3];
x.map(a => (a satisfies string, 2)) // Expected string, found 1 | 2 | 3
```

However, there are cases where forward is not enough

#### Wrong direction

One of the problems with this simple *forward pass* is when things are not forwards.

For example if we have functions of the form

```typescript
function func<T>(cb: (ev: EventKind[T]) => void, kind: T) {}

func((ev) => {}, "mousedown")
```

We do not know the expected type of the first paramter, until we have looked at the second parameter. 

Similarily if we write our function outside of the context of usage. Because forwards runs in the same direction as checking we cannot infer `ev` here until afterwards.

```typescript
function doWhenMouseDown(ev) {}

document.addEventListener("mousedown", doWhenMouseDown);
```

While the forward single pass has a ceiling, there are ways to performance inference above this.

### Backward inference

This is the harder and still work-in-progress kind of inference. It is also something new, an interpolation inside of existing TypeScript.

Where forwards involves **context** on the written parameter, backwards involves **usage** of the reference to the parameter.

```typescript
function sin(parameter: number) { 
	// ...
}

function func(param) {
	const property = parameter.value; // require the `parameter` to have a property under key `value`
	return sin(property) // require `parameter.property` to have type `number`
}
```

> This feature has been implemented before [in the Hegel type checker](https://hegel.js.org/docs#benefits-and-disadvantages-over-typescript).

The idea here is that **usage** of the value adds requirements to the *constraint* of the parameter (or any of its descendents).

You can see attempt #2 [working in a branch I started last year](https://github.com/kaleidawave/ezno/pull/197).

> This is attempt #2 at the feature. Attempt [#1 was partially working 3 years ago](https://kaleidawave.github.io/posts/introducing-ezno/#free-variables-(hidden-parameters)-of-functions), but the implementation required mutating the parameter type during checking of the body, which caused all sort of problems. This new one pushes a sequence of requirement or constraints to the current context. At the end of checking the body, these requirements are collapsed into a final type.

#### Steps for backward inference landing in `0.1.0`

While three of the [fundamental tests are passing](https://github.com/kaleidawave/ezno/pull/197/files#diff-8a0b8f92efee334818b42e62974af189aecb8ac866f988815040531489bb7062), there is still a bit more to do to move this from a demonstration to something that could make writing real-world type-safe code easier.

The first is to collect more examples of [untyped code](https://github.com/kaleidawave/ezno/discussions/195), to see whether there are more cases to collect and implement.

One of those is the cases is free-variables. Ezno does not infer constraints for variable in standard flow (which is a whole other topic). But when a variable crosses a function boundary, there is some special handling under the title of *free-variables*.

```typescript
let a = null;

function initialiseA() {
	a = data()
}

function doThing() {
	const x: string = a
}
```

Here `doThing` requires `a` to be `string` (not `null`). Some assignment needs to happen before any calls to `doThing`. 

The inference can treat find requirements for free variables (treating them the same as parameters), but currently attempt #2 checking for these constraints. Attempt #1 [did do this](https://kaleidawave.github.io/posts/introducing-ezno/#free-variables-(hidden-parameters)-of-functions) but I have concerns about performing this eagerly...

Another is conditionals, this is something attempt #1 could not achieve because of the mutations. Here `item` should infer as `{ tag: "a", data: number } | { tag: "b", data: string }` rather than `{ tag: any, data: string & number }`.

```typescript
if (item.tag === "a") {
	const x: number = a.data;
} else (item.tag === "b") {
	const y: string = a.data;
}
```

#### Allowing valid JavaScript, with new intrinsics

One of the aims of this feature is to allow JavaScript code to be checked. Here we want to catch **false-negatives**, errors that occur at runtime but are uncaught by the checker. But we also have to consider this could introduce **false-positives**. For example `Math.sin("2.2")` is totally valid, the string "2.2" can be passed and we do not get an error (Infact it returns `0.808...` as the function performs an implict cast). In fact any value passed to the `Math.sin` is valid (unless its `toPrimitive` throws). In the following, one argument is a `number` *type* and another *is not*, yet we get identical output...

```typescript
Math.sin(1/0) // NaN
Math.sin(new (class X {})) // (also) NaN
```

Currently the second call is outlawed by the rules TypeScript, which *technically* does not make a JavaScript superset...

In a previous post I outlined some [intrinsic types](/posts/experimental-types/) I added to the checker. These are types different to the standard root, union, interesection, generic etc types in that they have specific behavior for a situation. Most of them narrow down on some type, such as [`MultipleOf`](/posts/experimental-types#multipleof) that only allows numbers that are of some multiple to be passed. Some like TSCs `NoInfer` controls behavior around inference.

So a solution we could invent here is a new intrinsic type called `Warn`. This could have a type and tag associated with it. When the checker see that the RHS of the subtype matches the first type argument we could allow it but also emit an error that it was matched.

```typescript
type NumberLike = number | Warn<any, "implicit cast">;
//                         ^^^^

interface Math {
	sin(x: NumberLike): number;
}

declare const Math: Math;

// Warning (not error): "2.2" is allowed but is a "implicit cast"
Math.sin("2.2") 
```

> Any suggestions: for the name, usage etc are welcome on [this issue](https://github.com/kaleidawave/ezno/issues/235).

Then anything inferred from the argument passing would be valid as it currently [can create a false posiitive](https://github.com/kaleidawave/ezno/blob/d4142fe9471e688e2c03b228d6ecb7b8fde1b236/checker/specification/staging.md#from-argument).

### Wrapping up

There are still somethings to say about what backward inference can solve, but I will cut it here on the ideas and share them once it works.

You can read about [when the next release will be in the previous blog post](/posts/specification-speed-schedule/#schedule).

If you want to see more of this kind of thing you can follow me on [x](https://x.com/kaleidawave), [bluesky](https://bsky.app/profile/kaleidawave.bsky.social) and [join the existing great sponsors of the project!](https://github.com/sponsors/kaleidawave).
