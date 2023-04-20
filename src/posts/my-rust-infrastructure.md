---
layout: post.njk
title: My Rust infrastructure
description: Some libraries and tools I have built to help with writing Rust.
date: 2023-04-20
image: /media/rust-infrastructure-banner.png
tags: posts
---
I have written a lot of Rust over the last couple of years. Along the way of building a [compiler](https://github.com/kaleidawave/ezno), I have built up a few smaller, generic crates and tools (infrastructure) to assist with writing Rust. I realised I haven't really shared much about some of these, so I thought it would be a good opportunity to do give an overview now.

If you are interested in getting started with Rust: Last summer I wrote a collection of posts for [Shuttle](https://www.shuttle.rs/) (a great place to deploy Rust server applications). I wrote a bit about [patterns with Rust types](https://www.shuttle.rs/blog/2022/07/28/patterns-with-rust-types), [how Rust tackles error handling](https://www.shuttle.rs/blog/2022/06/30/error-handling) or [the builder pattern](https://www.shuttle.rs/blog/2022/06/09/the-builder-pattern) as [well as many others](https://www.shuttle.rs/blog/tags/all) . If you are looking to get started with Rust, check those posts out as well as their platform (IMO currently the easiest way to deploy a Rust server application).

> This post was meant to part of an upcoming post about the parser I just published, but this stuff didn't fit into that post. So I decided to split the content up. Look forward to a future post which includes things I learned about parsing and talks about some parser utility libraries I have written ([source-map](https://github.com/kaleidawave/source-map), [tokenizer-lib](https://github.com/kaleidawave/tokenizer-lib) and [derive-finite-automaton](https://github.com/kaleidawave/derive-finite-automaton)) etc.

I'll start off with a couple of libraries I've built that make it easier and shorter to write Rust code.

## Building macros with [syn-helpers](https://github.com/kaleidawave/syn-helpers)

Proc(edural) macros are a way of generating Rust code. Derive proc macros are Rust's approach to reflection. I wrote at length about reflection, the use cases and an example with a comparison between vanilla JavaScript and Rust in [this post on Shuttle.rs](https://www.shuttle.rs/blog/2022/12/23/procedural-macros). In summary proc derive macros allow generating Rust `impl` blocks based on the content of `struct` and `enum` declarations. For example `#[derive(Debug)]` above a `struct` declaration finds fields and generates a `impl Debug for ...` with a implementation that prints the field name alongside it's runtime value.

One thing about with proc macros is that you will likely be reaching for the dependencies `syn` and `quote` when writing them. The [API](https://doc.rust-lang.org/stable/proc_macro/) for writing them only gives us a low-level sequence of tokens. Fortunately [syn](https://github.com/dtolnay/syn) exists and can parse the sequence into an [AST](https://docs.rs/syn/latest/syn/struct.DeriveInput.html), which makes it a lot easier to read of fields. Generating output code is also made easier as [quote](https://github.com/dtolnay/quote) offers a declarative using a macro: [`quote!`](https://docs.rs/quote/latest/quote/macro.quote.html) ([`parse_quote!`](https://docs.rs/syn/latest/syn/macro.parse_quote.html) is also a similar thing and equally useful).

But just these on these own, it can still be difficult and verbose to build actual proc macros ([the code in the post only worked for structs with named fields](https://www.shuttle.rs/blog/2022/12/23/procedural-macros#procedural-macro-time)). Syn and quote offer great building blocks but they don't give you much help handling the setup required for derive proc macros.

Some of the problems I have run that make the code harder and longer to write and can also introduce bugs:
- Writing logic that can handle both `struct`s and `enum`s and their variants. You can use `self` to reference data in a `struct` , **but not in** an `enum`
- Creating expressions that access both named fields and unnamed fields
- Handling generics that exist on either on the structure or the trait, and how to handle if the names clash
- How to handle attributes, how to access them at different levels
- Forgetting to add `#[automatically_derived]`

To make this easier, last year I wrote a *'procedural macro framework'* that abstracted `syn` and this process to handle all these cases for you. It's a bit difficult to explain in words so here is an example which calls `do_thing` for all fields except ones marked with `ignore`.

```rust
use syn_helpers::{
    syn::{parse_quote, DeriveInput, GenericParam, Ident, Stmt}, proc_macro2::Span, quote,
    derive_trait, FieldMut, HasAttributes, Trait, TraitItem, TypeOfSelf, Constructable,
};

let my_trait = Trait {
    name: parse_quote!(::my_crate::MyTrait),
    generic_parameters: None,
    items: vec![TraitItem::new_method(
        Ident::new("method_one", Span::call_site()),
        None,
        TypeOfSelf::Reference,
        Vec::default(),
        None,
        |mut item| {
            item.map_constructable(|mut constructable| {
                Ok(constructable
                    .get_fields_mut()
                    .fields_iterator_mut()
                    .flat_map(|mut field| -> Option<Stmt> {
                        if field
                            .get_attributes()
                            .iter()
                            .any(|attr| attr.path.is_ident("ignore"))
                        {
                            None
                        } else {
                            let reference = field.get_reference();
                            Some(parse_quote!(do_thing(#reference);))
                        }
                    })
                    .collect())
            })
        },
    )],
};

let r#struct: DeriveInput = parse_quote! {
    struct X {
        a: String,
        b: i32
    }
};

let stream = derive_trait(r#struct, my_trait);

assert_eq!(
    stream.to_string(),
    quote! {
        #[automatically_derived]
        impl ::my_crate::MyTrait for X {
            fn method_one(&self) {
                let X { a: ref _0, b: ref _1 } = self;
                do_thing(_0);
                do_thing(_1);
            }
        }
    }.to_string()
)
```

Benefits of using the crate here
- `map_constructable` handles both enums variants and `struct`-ures.
- The code uses the [`Field`](https://docs.rs/syn-helpers/0.4.3/syn_helpers/trait.Field.html) trait which abstracts over generating expressions to access fields. Handling named and unnamed variants is automated away
- For fields whose type contains generics, it can add necessary `where` clauses if the trait is called on that field
- The macro also gets a structure. You get a more declarative code by laying out the [`Trait`](https://docs.rs/syn-helpers/0.4.3/syn_helpers/struct.Trait.html) with the items you need to implement. Those methods contain functions that handle generating the output.

For example in the parser I currently have a way of *visiting nodes* (running a set of functions over them), automating this implementation becomes quite simple using the `syn-helpers` library.

```rust
use proc_macro::TokenStream;
use std::error::Error;
use string_cases::StringCasesExt;
use syn_helpers::{
    derive_trait,
    proc_macro2::{Ident, Span},
    quote::{self, format_ident},
    syn::{parse_macro_input, parse_quote, DeriveInput, Stmt,
    Constructable, FieldMut, HasAttributes, NamedOrUnnamedFieldMut,
		Trait, TraitItem,
};

/// On the top structure
const VISIT_SELF_NAME: &str = "visit_self";
/// Per field modifiers
const VISIT_SKIP_NAME: &str = "visit_skip_field";
/// Add to chain. Can be on item or a field
const VISIT_WITH_CHAIN_NAME: &str = "visit_with_chain";

/// Usage #[derive(Visitable)]
#[proc_macro_derive(
    Visitable,
    attributes(visit_self, visit_skip_field, visit_custom_visit)
)]
pub fn generate_visit_implementation(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);

    let visit_item = TraitItem::new_method(
        Ident::new("visit", Span::call_site()),
        Some(vec![parse_quote!(TData)]),
        syn_helpers::TypeOfSelf::Reference,
        vec![
            parse_quote!(visitors: &mut (impl crate::visiting::VisitorReceiver<TData> + ?Sized)),
            parse_quote!(data: &mut TData),
            parse_quote!(settings: &crate::VisitSettings),
            parse_quote!(chain: &mut ::temporary_annex::Annex<crate::visiting::Chain>),
        ],
        None,
        |item| generated_visit_item(item, VisitType::Immutable),
    );

    let visit_mut_item = TraitItem::new_method(
        Ident::new("visit_mut", Span::call_site()),
        Some(vec![parse_quote!(TData)]),
        syn_helpers::TypeOfSelf::MutableReference,
        vec![
            parse_quote!(visitors: &mut (impl crate::visiting::VisitorMutReceiver<TData> + ?Sized)),
            parse_quote!(data: &mut TData),
            parse_quote!(settings: &crate::VisitSettings),
            parse_quote!(chain: &mut ::temporary_annex::Annex<crate::visiting::Chain>),
        ],
        None,
        |item| generated_visit_item(item, VisitType::Mutable),
    );

    let visitable_trait = Trait {
        name: parse_quote!(crate::visiting::Visitable),
        generic_parameters: None,
        items: vec![visit_item, visit_mut_item],
    };

    let output = derive_trait(input, visitable_trait);

    output.into()
}

#[derive(Clone, Copy)]
enum VisitType {
    Immutable,
    Mutable,
}

fn generated_visit_item(
    mut item: syn_helpers::Item,
    visit_type: VisitType,
) -> Result<Vec<Stmt>, Box<dyn Error>> {
    let attributes = item.structure.get_attributes();

    let visit_self = attributes
        .iter()
        .any(|attr| attr.path.is_ident(VISIT_SELF_NAME));

    let visit_with_chain = attributes.iter().find_map(|attr| {
        attr.path
            .is_ident(VISIT_WITH_CHAIN_NAME)
            .then_some(&attr.tokens)
    });

    let mut lines = Vec::new();

    if let Some(expr_tokens) = visit_with_chain {
        lines.push(parse_quote!( let mut chain = &mut chain.push_annex(#expr_tokens); ))
    }

    if visit_self {
        let struct_name_as_snake_case = &item.structure.get_name().to_string().to_snake_case();
        let mut_postfix = matches!(visit_type, VisitType::Mutable)
            .then_some("_mut")
            .unwrap_or_default();
        let func_name = format_ident!("visit_{}{}", struct_name_as_snake_case, mut_postfix);

        lines.push(parse_quote!( visitors.#func_name(self, data,  chain); ))
    }

    let mut field_lines = item.map_constructable(|mut constructable| {
        Ok(constructable
			.get_fields_mut()
			.fields_iterator_mut()
			.flat_map(|mut field: NamedOrUnnamedFieldMut| -> Option<Stmt> {
				let attributes = field.get_attributes();

				let skip_field = attributes.iter().any(|attr| attr.path.is_ident(VISIT_SKIP_NAME));

				let visit_with_chain = attributes.iter().find_map(|attr| {
					attr.path.is_ident(VISIT_WITH_CHAIN_NAME).then_some(&attr.tokens)
				});

				let chain = if let Some(expr_tokens) = visit_with_chain {
					quote!(&mut chain.push_annex(#expr_tokens))
				} else {
					quote!(chain)
				};

				if !skip_field {
					let reference = field.get_reference();
					Some(match visit_type {
						VisitType::Immutable => parse_quote! {
							crate::Visitable::visit(#reference, visitors, data, settings, #chain);
						},
						VisitType::Mutable => parse_quote! {
							crate::Visitable::visit_mut(#reference, visitors, data, settings, #chain);
						},
					})
				} else {
					None
				}
			})
			.collect::<Vec<_>>())
    })?;

    lines.append(&mut field_lines);

    Ok(lines)
}
```

It takes around 140 lines to implement this trait. `syn-helpers` here handles cases when the AST contains generics. Using `syn-helpers` means the code can focus on the actual behaviour of the trait rather than handling all the different cases Rust declarations can be in.

---
Although it is called `syn-helpers` and that was it's original aim, it has now grown out into a large framework focused on derive macros. So if you write derive macros and maybe struggle with keeping things concise. I want it to be used for more than my own work! If you have API/abstraction you want added for a proc-macro you are writing I am open [for discussion](https://github.com/kaleidawave/syn-helpers/issues).

Building this out I feel it might be close to a fully declarative macro implementation [notes here](https://github.com/kaleidawave/syn-helpers/issues/1). Rust current has declarative macros but anything `derive` based has to be done imperatively and there isn't a end to end declarative approach. Maybe it could be tried out in this library.

### Putting the framework to build more customisable `derive` implementations

I had written two macros before, and `syn-helpers` *helped* tidy up and share the code between these two. The two main ones are:

### `#[derive(DebugExtras)]`
`#[derive(Debug)]` is great most times, but sometimes it lacks a bit of customisation for the derive item. [derive-debug-extras](https://github.com/kaleidawave/derive-debug-extras) offers an enhanced macro that adds `#[debug_ignore]` and `#[debug_as_display]` attributes that can help improve debugging.

But arguably my favourite one is [`#[debug_single_tuple_inline]`](https://github.com/kaleidawave/derive-debug-extras#debug_single_tuple_inline). This fixes a problem in the Ezno checker. I use a lot of the new type pattern to declare identifiers. Unfortunately, despite them only having one field, when debugging them with the pretty flag (I want other named structs to be over lines) it ends up over three. So although it did require rewriting the standard debug implementation, now:

```rust
// Without #[debug_single_tuple_inline]
[
    A(
        123
    ),
    A(
        145
    ),
    A(
        125
    ),
]
// With #[debug_single_tuple_inline]
[
    A(123),
    A(145),
    A(125),
]
```

IMO, all unnamed fields when debugged should be on one line despite the pretty flag.
### `#[derive(PartialEqExtras)]`
In a similar vein, [derive-partial-eq-extras](https://github.com/kaleidawave/derive-partial-eq-extras) adds a more customisable [PartialEq](https://doc.rust-lang.org/std/cmp/trait.PartialEq.html) implementation. It adds two new attributes for ignoring certain fields in the implementer.

For example, in my parser, expressions have positions and IDs. However, when comparing two expressions I want to treat them on a value basis and not based on position or identifiers. For example, given the literal expression `5`, I want that AST to equal other `5`s, no matter where they have been parsed. To do this I simply add `#[partial_eq_ignore_types]`, which I can use really easily on expression AST:

```rust
#[derive(PartialEqExtras, Debug, Clone)]
#[partial_eq_ignore_types(Span, ExpressionId)]
pub enum Expression {
	NumberLiteral(NumberStructure, Span, ExpressionId),
	StringLiteral(String, #[partial_eq_ignore] Quoted, Span, ExpressionId),
	BooleanLiteral(bool, Span, ExpressionId),
	RegexLiteral {
		pattern: String,
		flags: Option<String>,
		position: Span,
		id: ExpressionId,
	},
	ArrayLiteral(Vec<SpreadExpression>, Span, ExpressionId),
	ObjectLiteral(ObjectLiteral),
	...
```

> This is similar to [educe](https://docs.rs/educe/latest/educe/#ignore-fields-1), however it does not have the *ignore types* feature, so declarations can get clobbered with annotations on lots of fields. I did try and add it to educe but got a bit scared by its codebase.

Again look into the sources and see that they are slim as they are built of `syn-helpers`

## Assisting with sum `enum`s
In the parser, I often have types that sum together some struct definitions like

```rust
#[derive(Debug, Clone, PartialEq)]
pub enum Declaration {
	Variable(VariableDeclaration),
	Function(Decorated<StatementFunction>),
	Class(Decorated<ClassDeclaration<StatementPosition>>),
	Enum(Decorated<EnumDeclaration>),
	...
}
```

Converting in and out can be a bit of a pain. If I have a function that takes a `Declaration` I need to remember the variant and then wrap the whole expression in it. So I created [derive enum from into](https://github.com/kaleidawave/derive-enum-from-into). With this, I can add `#[derive(EnumFrom, EnumTryInto)]` to have an easier time converting between the two (including immutable and mutable references).

```rust
#[derive(Debug, Clone, EnumFrom, EnumTryInto, PartialEq)]
#[try_into_references(&, &mut)]
pub enum Declaration {
	Variable(VariableDeclaration),
	Function(Decorated<StatementFunction>),
	Class(Decorated<ClassDeclaration<StatementPosition>>),
	Enum(Decorated<EnumDeclaration>),
	...
}

fn my_func(var_dec: VariableDeclaration) {
	let dec = Declaration::from(var_dec);
	assert!(matches!(dec, Declaration::Variable(_)));
	let result = Decorated::<StatementFunction>::try_from(dec);
	assert!(result.is_err());
}
```

> This is a smaller, less configurable, `enum` only version of [#[derive(From)] from the derive_more crate](https://jeltef.github.io/derive_more/derive_more/from.html)

This crate is actually my most downloaded, possibly because it seems to be used on this [popular project](https://github.com/near/nearcore/blob/02bd5996d0e581f12768baa9f3f68849a77a8312/Cargo.toml#L121).

## Iterator endiate

A smaller one, but I often have a case when iterating through something I want to know if it is the last one. This often happens in the to-string part of my parser where I want to add a comma delimiter between items but don't want a trailing comma. For [iterators with a known size](https://doc.rust-lang.org/stable/std/iter/trait.ExactSizeIterator.html), this crate adds an [extension trait](http://xion.io/post/code/rust-extension-traits.html) that adds the `endiate` method. Similar in functionality to the `enumerate`.

```rust
// adds `.endiate()` method to all (sized) iterators
use iterator_endiate::EndiateIteratorExt;

for (at_end, item) in items.iter().endiate() {
	settings.add_indent(depth, buf);
	item.to_string_from_buffer(buf, settings, depth);
	if !at_end {
		if item.requires_semi_colon() {
			buf.push(';');
		}
		if settings.pretty {
			buf.push_new_line();
		}
	}
}
```

Also adds the `nendiate` for when you are want to know you are not at the end

## Enums and strings

[Enum variants strings](https://github.com/kaleidawave/enum-variants-strings) is a library for converting between (yes, both ways) `&str` and `enum` structures. The derive macro handles generating this based of variant names. Mapping from a string to an `enum`, works for simple things that implement [`Default`](https://doc.rust-lang.org/stable/std/default/trait.Default.html).

```rust
use enum_variants_strings::EnumVariantsStrings;

#[derive(Debug, PartialEq, EnumVariantsStrings)]
enum Variants {
    X,
    Y(i32),
    #[enum_variants_strings_mappings("z", "zee")]
    Z {
        x: String,
        y: String,
    },
}

fn main() {
    assert_eq!(Variants::from_str("x"), Ok(Variants::X));
    assert_eq!(Variants::from_str("y"), Ok(Variants::Y(0)));
    assert_eq!(
        Variants::from_str("z"),
        Ok(Variants::Z {
            x: String::default(),
            y: String::default(),
        })
    );

    assert_eq!(Variants::X.to_str(), "x");
    assert_eq!(
        Variants::Z {
            x: "abc".into(),
            y: "xyz".into()
        }
        .to_str(),
        "zee"
    );
}
```

[I use it for changing between modes in the ast-playground of Ezno](https://github.com/kaleidawave/ezno/blob/75d31ddb60eee495915fcf805a56221d2e79ce7d/src/ast_explorer.rs#L40).

## Deploying Rust with GitHub actions

I like GitHub actions because centralised compute. In my crates, I want the update commit to automatically push the version change back to the repository. If I do it manually, I always forget to push after, things get out of sync.

So I built a GitHub action for doing this: [crates-release-action](https://github.com/kaleidawave/crates-release-gh-action)

Here is how you can use it:

```yaml
name: Release crate

on:
  workflow_dispatch:
    inputs:
      version:
        description: "major/minor/patch or semver"
        required: false
        default: "patch"

concurrency: release-crate

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set git credentials
        run: |
          git config user.name github-actions
          git config user.email github-actions@github.com
      - name: Crates publish
        uses: kaleidawave/crates-release-gh-action@main
        id: release
        with:
          version: ${{ github.event.inputs.version }}
          crates-token: ${{ secrets.CARGO_REGISTRY_TOKEN }}
      - name: Push updated Cargo.toml
        run: |
          git tag "release/${{ steps.release.outputs.new-version }}"
          git add .
          git commit -m "Release: ${{ steps.release.outputs.new-versions-description }}"
          git push --tags origin main
```

It handles:
- Finding manifests
- Applying `major`, `minor` or `patch` to a version (or an exact version) and updating the contents of `Cargo.toml`
- Finding local manifests which reference it as a path dependency to update their version
- Publishing to [crates.io](https://crates.io/)
- Outputting the new version(s) in a machine readable format (so it can be referenced in commit names and tags)

You can run it through [github.com](https://docs.github.com/en/actions/managing-workflow-runs/manually-running-a-workflow)

{% image "/media/github-publish-crate-ui.png" %}

Or from the command line with [gh](https://cli.github.com/)

{% video "/media/crates-gh-push.mp4" %}

Which I can watch

{% image "/media/github-publish-crate-cl-watch.png" %}

Behind the scenes it updates the packages in the order of least dependency (I don't want to rely on myself for ordering arguments, [it can be calculated](https://github.com/kaleidawave/crates-release-gh-action/blob/4dd293538aec8fc068acf08f35e60c0d015b7547/updater.py#L54-L66)). It also uses a TOML parser that retains the TOML formatting. It is currently written in Python. If anyone wants to rewrite it in Rust and/or add more functionality, LMK!.

> It is a manual action currently, and isn't particularly automated. It doesn't track changes in a workspace, or figure out *Semver* or build changelogs. I want the base to be simple and un-opinionated

---

I didn't have space but two more crates I have made are: [multiline-term-input](https://crates.io/crates/multiline-term-input), which is a way to break into new lines during console input ([It need a wiz to add Linux support](https://github.com/kaleidawave/multiline-term-input/issues/1)) and [temporary-annex](https://crates.io/crates/temporary-annex) that helps to work with appending data temporarily while reusing **the same** backing (linear) buffer.

And that is all. If you have built or use any cool Rust libraries or additional tools let me know in the comments!
