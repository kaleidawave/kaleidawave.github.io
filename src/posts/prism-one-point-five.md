---
layout: post.njk
title: Prism Compiler 1.5
description: Updates to Prism compiler, server side rendering and why frameworks
date: 2021-03-22
image: /media/prism-one-five-banner.png
includeImage: false
tags: posts
---

Prism 1.5 is out now. This post goes over the [server component](#server-components) craze, [frontend frameworks on the backend](#frontend-frameworks-on-the-backend), [why frameworks](#why-frameworks) and the [future of Prism](#prism-future).

Prism is a experimental framework for building web apps which takes declarative templates written in HTML, CSS and JS (similar to svelte and vue) and compiles them into ultra small & efficient client and server bundles. It is more of a research project into some ideas of what I thought could be the most efficient full stack framework.

## "Server components"

Last December we saw two big announcements in the world of server rendering. The first was [React server components](https://reactjs.org/blog/2020/12/21/data-fetching-with-react-server-components.html) which enables components VDOM content to be rendered on the server. The other was [hotwire](https://hotwire.dev/) which is a set of libraries for adding more interactivity on the page through communicating with the server.

These two announcements sparked ideas around *"server components"* which is a different to the status quo in standard data loading & rendering flow:

Standard AJAX flow:

<h4 class="center">
    Read request → JSON → parse → build DOM → append to node
</h4>

HTML (or VDOM) over the wire:

<h4 class="center">
    Read request → append request body to node
</h4>

Both are interesting ideas. Hotwire is a interesting take on how to use server side rendering for more than initial page load. And React server components are a acknowledgment that strictly client side design isn't perfect.

<h4 class="center">
    But looking at both notice that they have heavy constraints and their performance claims may be overstated. For Prism, I wanted to capitalize on some of the benefits of rendering on the server but in a more flexible and low runtime way. 
</h4>

All frameworks are based on components so to start we can send the following HTML down the wire:

```html
<story-preview>
    <div class="buttons">
        <button disabled>&#9650;</button>
        <button disabled>&#9660;</button>
    </div>
    <div>
        <h2>
            <a href="https://chartscss.org">Charts.css</a>    
        </h2>
        <span>
            882 points | by
            <a href="/u/pspeter3">pspeter3</a>    
            <span title="Sun Mar 21 2021 10:37:57 GMT+0000">| 1 days ago |
            <a href="/i/26494819">135 comments</a>
        </span>
    </div>    
</story-preview>
```

<h6 role="caption">(Simplified) Examples from <a href="https://github.com/kaleidawave/hackernews-prism">HN prism</a></h6>

This example would have been rendered on the server, interpolating data from some source, database etc.

This is great, the browser can parse the response body and render the tree in a highly optimized procedure with 100% browser support without needing JavaScript. The links are readily clickable and the buttons have a `disabled` attribute considering they don't have any functionality until a JS event listener is attached.

While this is great there are several scenarios where you want to do some work on the client with the components the server responded with. For example:

```js
// Upvote post (needs previous value)
this.data.score += 1; 

// Saving title in indexedDB
objectStore.add(this.data.title); 

// Making request with data
fetch(`/upvote-post`, { 
    method: "POST", 
    body: new URLSearchParams({"postID": this.data.postID})
})
```

To run the above the client needs to know the value of the data used to render the component's markup. However given the server sent markup it's not known what the data used to render that page on the server looked like. Neither is there any way of guessing, there are 8 numbers in the response any of those could be the value for `score`.

So the answer by most frameworks is to serialize the data used to render that component on the server and include it in the response. During the hydration the serialized data can be deserialized and stored in memory as the page data through `JSON.parse`. Here is a example of a response with the additional serialized data:

```html{data-highlight=10,20}
<story-preview>
    <div class="buttons">
        <button disabled>&#9650;</button>
        <button disabled>&#9660;</button>
    </div>
    <div>
        <h2>
            <a href="https://chartscss.org">Charts.css</a>    
        </h2>
        <span>
            882 points | by
            <a href="/u/pspeter3">pspeter3</a>    
            <span title="Sun Mar 21 2021 10:37:57 GMT+0000">| 1 days ago |
            <a href="/i/26494819">135 comments</a>
        </span>
    </div>
    <script type="data">
        {
            "url": "https://chartscss.org/",
            "title": "Charts.css",
            "score": 882,
            "by": "pspeter3",
            "time": "Sun Mar 21 2021 10:37:57 GMT+0000",
            "id": 26494819,
            "descendants": 135
        } 
    </script>
</story-preview>

```

But this is bad as now each response is now considerably larger due to the same data now existing both in the markup and in the JSON blob (as shown with the highlighting). This problem is often referred to as the *double data* problem. This is especially a problem in VDOM and render to hydrate based frameworks which require all the data to start [1](#foot1).

### A better implementation {#jit-hydration}

As we have seen just looking at the HTML response it is impossible to pull data from it. But now if I show you the template that was behind what was used to render `story-preview`'s HTML then it becomes understandable where those values were interpolated:

```html
<template>
    <div class="buttons">
        <button @click="upvote">&#9650;</button>
        <button @click="downvote">&#9660;</button>
    </div>
    <div>
        <h2 #if="url">
            <a $href="url" target="_blank" rel="noopener noreferrer">{title}</a>
        </h2>
        <h2 #else>{title}</h2>
        <span class="details">
            {score} points | 
            <a relative $href="`/u/${by}`">by {by}</a>
            <span $title="time"> | {timeFromNowToString(time)} ago | </span>
            <a relative $href="`/i/${id}`">{descendants} comments</a>
        </span>
    </div>
</template>
```

<h6 role="caption">From <a href="https://github.com/kaleidawave/hackernews-prism/blob/4537652060e0011e2e34be5de64036302d739a03/src/views/story-preview.component.prism">story-preview on hackernews-prism</a></h6>

The template reveals what is interpolated where. Comparing it to the previously shown response you can begin to see where values match up to the server response. For example there is a variable/property named `score` which comes before "points". 

<h4 class="center">
    Knowing how the data maps in the template, a sufficiently smart compiler could generate JS getters for retrieving data from the server rendered DOM.
</h4> 

In the above example, title could be retrieved at runtime with the following getter:

```js
get title() {
    return component.querySelector("h2").innerText 
}
```

Using this method, state could be brought into JS from the server rendered content making a JSON blob redundant. No more JSON state reduces the bytes sent over the wire. 

And this is how the state hydration system in Prism works. The compiler builds a table of bindings in the template. From that it can generate code similar to the above statement. This same binding table is also used to generate set bindings for reactivity.  

In the following HN clone you can see HTML come down the wire for rendering `story-preview` components:

{% video "/media/full-server-component-data-hydration.mp4" %}

From this you can see the `story-preview` components content is coming from the server as HTML. The rendered markup only contains one instance of the components `title`, `score` and `url` properties thus **no double data**. `temp1._d` shows what data the component was given during instantiation but when `JSON.stringify(temp1.data)` it evaluates every property through looking it up in the components server rendered DOM. The comments (`<!---->`) in the response are to break up text nodes.

Not only is the state available to the component but is also public to other components. Running `JSON.stringify(document.querySelector("index-page").data, 0, 4)` should see a object with a array of stories. Those stories exist on the individual components but modifying externally is permitted: `document.querySelector("index-page").data.stories[2].title = "Hello World"`

The resolved data is being pulled from the HTML content of the component.

With fast and efficient hydration Prism server components can send standard HTML down with interactivity on the client. A component can mark that its content should be from the server via the `@RenderFromEndpoint` decorator which takes a parameterized url which points to endpoint which returns the content of the component. 

```js
@RenderFromEndpoint("/story-preview/:id")
export class StoryPreview extends Component<IStoryItem> {
    ..
```

Which is compiled down to:

```js
render() {
    fetch(`/story-preview/${this.data.id}`).then( async (resp) => {
        this.innerHTML = await resp.text(); this.handleEvents?.(true)
    })
}
```

<h6 role="caption">No streaming yet<a href="#foot4">4</a></h6>

One nicety of this is that it associates data under a id. Prism (and most other frameworks) work by a parent component resolving data and then rendering a child component with that data. With this system, components are *self aware* and rerender themselves on updating `id`:

{% video "/media/single-server-component.mp4" %}

The HTML is coming from a Prism compiled *toString* function which given data returns a string of the concatenated component markup. With this all that is required is hosting a endpoint which calls the generated function and returns the response:

```js
// Import prism compiled function
import { renderStoryPreviewContent } from "./out/story-preview.prism";

app.get("/p/:id", (req, res) => {
    res.send(renderStoryPreviewContent(getStoryPreview(req.params.id)));
});
```

<h6 role="caption">As Prism only builds the functions you can build the backend using any node framework or alternatively use them on a serverless function platform</h6>

The server generated function and hydration system was an existing process for initial SSR. With server components the efficiencies in these methods now extend to lifecycle of the page. I haven't seen any other frameworks implement this sort of resolving state using the server rendered markup. And while I am not the first to suggest this I think Prism is the first and only comprehensive implementation of this idea. From now on I will refer to this system as **JIT (just in time) Hydration**. This system is not a *two way binding system* as the retrieval is only done once. *Two way bindings* often refers to inputs whose value fires updaters when the value of a input changes.

Prism already has incredible bundle sizes. Without server components the total uncompressed bundle is `17kb` and after converting `story-preview` and `story-page` for their content to be rendered on the server it comes to `16.08kb` which is `4.76kb` after GZIP. The saving of around ~`1kb` is around removing server loading logic and (some) of the render methods for the components. The bundle could be ~25% less if Prism could tree shake the reactivity logic and minify identifiers.

##### Some other features Prism has around JIT hydration

- *Getting* values is lazy. The get logic is only called when the value is evaluated 
- *Getting* values is done on a **per property basis**. `title` can be in the JS runtime but not `time`
- Caches the returned value as to not be a call to the DOM every time
- Events are attached during hydration via compiled methods which finds elements and calls `addEventListener`. Unlike others, Prism does not do any sort of rerendering in order to add event listeners. This results in super quick TTI
- Even though the DOM is made up of strings, Prism can convert various types. This is why type declarations are required [2](#foot2).

##### Using `@RenderFromEndpoint` has the following benefits

- Skipped the parse cycle on the JSON returned from the HN REST api and generating the nodes on the client which should be a little bit faster
- Reduced the client logic for getting the data and rendering nodes

##### Compared to React server components

- Rendering stateful components ([RSC does not allow for stateful components](https://github.com/josephsavona/rfcs/blob/server-components/text/0000-server-components.md#capabilities--constraints-of-server-and-client-components))
- Significantly smaller JS size. React starts at `133kb` uncompressed, Prism starts at `2kb`
- Non JS reliance (see [next section](#frontend-frameworks-on-the-backend))

One thing I will give React server components is the ability to write [backend logic inline with the server components](https://github.com/reactjs/server-components-demo/blob/3a505efea0b1191496a832e23f3de46a0db69915/src/NoteList.server.js#L20) which while it doesn't enable anything is kinda neat.

##### Compared to Hotwire

- Prism is hybrid and defaults to client rather than going back to server
- Significantly smaller JS size. Stimulus is `77.4kb` and Turbo is `80.4kb`
- Smaller response payloads. Stimulus attribute based logic is sent down on every response where Prism compiles logic into the JS bundle which size is constant and can cached between requests
- Stimulus a similar DOM based hydration system to Prism although it [seems to suffer from the double data problem using `data-*-value` attributes](https://stimulus.hotwire.dev/handbook/managing-state#reading-initial-state-from-the-dom)

##### On JSON vs HTML {#json-vs-html}

So the good thing about sending HTML down is that it can be readily placed into the tree without a transformation step. Comparing the sizes: JSON includes the keys whereas with Prism's hydration system encodes the key mapping into the hydration codegen which is constant for any incoming data. HTML is a data language although data is nested within a bunch of UI markup. For example on every `story-preview` it has to send two buttons for each component although with JSON only the raw data is sent and the buttons are added via constant bundle code.

Looking at HN frontpage the average JSON size for `story-preview`s was around `220bytes` whereas the average inner HTML size was around `600bytes`. Thus making HTML around `2.5x` larger than it's equivalent JSON representation.

The figures are a little skewed against HTML as Prism includes identifier classes, which could be reduced if Prism moved to a [index based element lookup system](https://github.com/kaleidawave/prism/issues/31). And the size factor varies between components depending on how much of the template is made of data compared to static markup. There is also the fact some of the literal expressions cannot be reversed so a little bit of extra data is added [3](#foot3). These figures are ignoring compression which may have a disproportionate effect between the formats and may close the size gap. But both formats aren't great data formats for small efficient data flow. *Inspired by [serde](https://serde.rs/)*, I have some opinions on how compilers and strong types could be used for making more efficient serialization and deserialization.

##### On JIT hydration vs Partial hydration {#jit-vs-partial}

One improvement to *full* hydration are techniques partial and progressive hydration. Partial hydration seems to benefit render to hydrate frameworks (which Prism isn't) by rerendering only *islands* (rather than the whole page) to add interaction. Partial hydration is difficult to implement though as it is difficult to know what portions are interactive and stateful. And although *static* regions are now ignored *dynamic* regions still suffer from the double data and rerender issue. In this case for HN Prism this means the biggest components `story-preview` and `story-page` aren't any more optimized.

And progressive hydration is incrementally making portions interactive rather than waiting for everything to be processed before interaction is added.

But Prism doesn't suffer from any of this. Whether a component is stateful or not it still doesn't send a JSON blob or *rerender* its content. The state is ultra partial and progressive considering properties are only retrieved when they are being evaluated and only the single property of that object is *hydrated* in. **I think JIT hydration and the code generation around the data is the only way to solve the double data problem while sending down only the HTML for stateful components**.

##### Frontend frameworks on the backend {#frontend-frameworks-on-the-backend}

One of the arguments behind Hotwire is that it's system *works* for server rendered sites built in languages other than JS. This is generally a problem with all frontend frameworks. React, Vue, Angular and Svelte all have some API to render their templates to a string **but** they are all restricted to the JS language. This is a big gap as there are lots of other backend frameworks and tools for languages not in JS.

**So for Prism I added the ability to target Rust for it's server side rendering output**. The HN demo is written as Rust+ActixWeb server. Speed was a focus for this site which is why [ActixWeb was chosen as it is one of the fastest backend frameworks](https://www.techempower.com/benchmarks/#section=data-r20&hw=ph&test=fortune). The deserializing from the HN REST API is done with [Serde](https://serde.rs/) which is renowned for it's speed. And of course the compiler based GC heavily optimized Rust language base is key to these results. [Comparing ActixWeb against Express](https://medium.com/@maxsparr0w/performance-of-node-js-compared-to-actix-web-37f20810fb1a), Actix excels the node framework in every benchmark. The biggest standout of this article though is that Actix is 6x more efficient than node. This is great for lowering server runnings costs and most importantly a sixth of the electricity 🌲🌳. Additionally Prism server side rendering is also available for node & Deno.

For those building a Rust REST backend to a client side rendered site it means you can add SSR to it without having to deal with both a node and a Rust server and communication between the two. 

Yep thats right Rust {% icon "rust" %} server side rendered web components, never thought you'd see those words together.

All that is required to render a Prism component/page is to wire up the Prism generated method to a endpoint:

```rust{data-highlight=1,9}
// Import Prism generated method:
use templates::story_page_prism::render_story_page_page;

#[get("/i/{storyID}")]
async fn story_page(web::Path((story_id,)): web::Path<(i32,)>) -> HttpResponse {
    let result = api::items::get_story(story_id).await;
    if let Ok(post) = result {
        HttpResponse::Ok()
            .content_type("text/html")
            .body(render_story_page_page(&post))
    } else {
        HttpResponse::InternalServerError().finish()
    }
}
```

The fact that React server components were restricted to a node backend was discussed in the [comments of the RFC](https://github.com/reactjs/rfcs/pull/188). Without embedding v8 and making calls it looks pretty distant that React SSR could be fully functioning on non node backends. The difficulty with embedding v8 is that you lose strong typing from Typescript. 

I should also mention WASM & Rust based "frontend-frameworks" [yew](https://yew.rs/), [percy](https://github.com/chinedufn/percy) & [seed](https://github.com/seed-rs/seed) here. They look very interesting, make effective use of procedural macros, have Rust SSR support and are really the first real way to write DOM based client side code in a non compile to JS language. However WASM has a few disadvantages for the client side apps. First the size of WASM bytecode seems to be larger than if the logic was written in JS. I don't quite know the specifics of WASM bytecode but from for machine bytecode know that things like generic implementations, bundling standard library and inlining bumps up the size. All of which JS doesn't suffer from. Yew states that its examples bundle is ~`100kb` which is similar in size to React which isn't great for slower connections. Also the component sizes are likely to be larger than if they were written in JS. Yes their bundle is faster to parse and compile but TTI is hampered from loading over the network. Secondly they seem to use VDOM and diffing (rather than a compiled reactivity approach) so while being close to the metal they still generally do more computation vs direct compiled setters. That also means they probably suffer from the double data issues that Prism escapes. Also the fact that WASM can't call arbitrary JS methods and instead has to be passed them. So fetching etc still requires writing JS and passing references to the instance. Cool at the moment for canvas rendering etc but generally not the silver bullet for JS based frontend frameworks.

For Prism the most promising feature with WASM is the available runners. If Prism could compile SSR functions for WASM then it could be used with the [python runner](https://github.com/wasmerio/wasmer-python) and wouldn't have separate compiler outputs and would be more lightweight than embedding v8. Untested but I think Prism's [rust output as binary could be called from the python runtime](https://avacariu.me/writing/2014/calling-rust-from-python) or any other language that can call c like code.

##### Reflection on Prism

With Prism I took a lot of the problems around frontend frameworks today in to account with the design. I hope I at least made a dent on some of these issues:

- Double data from SSR
- SSR in non node languages (e.g. Rust)
- Large bundle sizes

At this point it seems necessary to mention why frameworks? and why plain JS or no build step is insufficient in many cases.

### Why frameworks? {#why-frameworks}

Frameworks generally implement a single declarative way to mark that this variable/data/state is interpolated here. Reactivity mechanisms ensure that the view is always up to date with the current value of the variable/data/state. Generally HTML doesn't have a way to express a binding with JS. So updating the view is done imperatively:

```js{data-highlight=7,18}
customElements.define(
    "counter-component", 
    class extends HTMLElement { 
        counter = 0; 
        
        connectedCallback() {
            const h1 = document.createElement("h1");
            h1.innerHTML = this.counter;
            const button = document.createElement("button");
            button.innerHTML = "+";
            button.addEventListener("click", () => {
                this.incrementCounter();
            });
            this.append(h1, button);
        }
        
        incrementCounter() {
            this.counter += 1;
            this.querySelector("h1").innerHTML = this.counter;
        }
    }
);

const counterComponent = document.createElement("counter-component");
document.body.append(counterComponent);
```

<h6 role="caption">(excludes cleanup)</h6>

Here the interpolation of `this.counter` is done imperatively. And due to this it requires writing the interpolation logic twice. Writing twice is a little time consuming but the worst effect is that the logic is split up. If the first part is modified for example `h1` tag is changed to `h5` then the second part is broken and it's not clear for a linter to pick this up. The *desync* issue here is manageable but when you have lots of components with lots of interpolation spread across a large project with lots of contributors it gets difficult to manage. There is also the fact that the imperative calls are quite distant from the declarative design of the HTML language and reading & processing the above is more difficult. But the lack of interpolation synchronization only gets worse..

#### Universality / SSR {#ssr}

The reactivity issue is further amplified when work is shared between the client and server. For this example a *"post"* is sent down with some interpolated data.

`server.js`:
```js
res.send(`
    <h1>${postTitle}</h1>
    <button id="upvote-button">Upvote post</button>
    <span id="upvotes">${upvotes}</span>
`);
```

And after some action on the frontend incrementing `this.upvotes`. Updating the text of the span is done with:

`client.js`:
```js
document.querySelector("span#upvotes").innerText = this.upvotes += 1;
```

This is not great because there is a loose reference to `span#upvotes`. The server response may be changed to use `p` instead of a `span` and now the `querySelector` call returns null. It is not easy to find the issue and often ends up in "spot the difference" or "wheres wally" scenario across separate files. I have found this on large projects where I go to change or add a button and now have to find out what code was relying on that button and what that affects. This problem is amplified when there are tens of pages and hundreds of places where things are interpolated and events are connected.

##### Checking

There is also the fact that the above server code is a raw string literal. It does not check if it is valid HTML at compile time (some templating languages may do not quite sure) so I have often lost time after writing something like `<h1 ${someX}</h1>`. With Prism it will always concatenate to valid HTML and as a compiler it also catches syntax errors when parsing templates. The Svelte framework takes this checking a step further linting the template with rules to ensure accessible HTML. This is only really possible with the template DSL of Svelte as a template literal can still be valid without knowing whats interpolated.

The other thing Prism does is add `disabled` to buttons with events which it then removes on adding event listeners during hydration. Also the above snippet is susceptible to XSS scripting attacks. Prism (and other template languages) wrap all interpolations in escape safe calls. The other thing is Prism auto generates non-clashing ids. The incrementing example above would break if I added a new element on the page with a id `#upvotes`. 

##### Lists

With lists you may want to render the first 10 items in the server responses and later add more in a infinite style way (the same way Twitter and Instagram feeds work). So on the server I may write a function which rendering a element of a list:

```js
function renderListItemToString(item: IPost): string { .. }
```

However now on the client if I wanted to append a new item the `renderListItemToString` is only available on the backend not the frontend. With a framework that has or compiles to multiple functions depending on runtime the same list item elements can be generated on both the frontend and backend. I guess this is a advantage of server components and turbo where that the frontend function is a alias for calling the same function on the backend under the same source.

#### Single source

So frameworks implement some sort of single source. For example in Prism:

```html
<template>
    <h1>{postTitle}</h1>
    <button @click="upvotePost">Upvote post</button>
    <span>{upvotes}</span>
</template>

<script>
    public interface PostData {
        postTitle: string, 
        upvotes: number
    }

    @WithCapacity(100)
    class Post extends Component<PostData> {
        upvotePost() {
            this.data.upvotes += 1;
        }
    }
</script>
```

The template is declarative. It abstracts on the imperative `document.createElement` and `attachEventListener` calls. The template is much more akin to HTML and understanding the structure of this component is more accessible. The span <-> `upvotes` binding is only written once. And so if `span` was changed to `p` there are no other handwritten references of this binding and compiling would take care of updating all references to span with references to the `p` element. For full reactivity and JIT hydration, Prism will take the single source and generate the n number of implementations. These would be tricky to manage if written manually. For example the upvotes binding eventually ends up in four places:

`client.js`:
```js{data-highlight=2,8,9}
// Initial render
render() {
    this.append(.., h("span", {class: "p120"}, 0, this.data.upvotes))
}
// Reactive bindings
bindings = {
    ..
    upvotes: {
        get() { return parseInt(this.getElem("p120").innerHTML); },
        set(value) { this.getElem("p120").innerHTML = value; },
    }
}
```

`server.rs`:
```rust{data-highlight=8}
pub struct PostData {
    postTitle: String, 
    upvotes: f64
}

fn render_post(post: IPost) -> String {
    let mut acc = String::from_capacity(100);
    ..
    acc.push_str(&data.upvotes.to_string());
    ..
    acc;
}
```

In terms of doing this, to get the biggest abstraction at a low cost requires a build step to do static analysis on ASTs and do specific code generation. 

The other benefit of Prism, Svelte and Vue is that they use single file components. These allow you to write css in the same file as the components.

```html
<template>..</template>
<script>..</script>
<style>
    div.container {
        width: 80%;

        h1 {
            color: red;
        }
    }
</style>
```

<h6 role="caption">There are many benefits in readability in having css alongside the components. Prism and others also automatically scope classes so that other <code>div.container</code>s are not affected outside of the component</h6>

## Other Prism changes

#### Observable date instances

One design of Prism is for effectively act as if the DOM was a result of a *getter*. And the view should always be 1:1 to the value of the evaluated getter

```js
class MyComponent {
    date = new Date()

    get content() {
        return `<h5>${formatDate(this.data)}</h5>`
    } 

    addMinuteToDate() {
        this.date.setMinute(this.date.getMinute() + 1)
    }
}
```

Frameworks have something where you tell it to update with the new state. React's `setState` is a abstraction over rerendering the DOM as React doesn't really have a concept of state. It should be `rerenderWithTheseValues`. Simply setting a property in a React will not make the view update. 

Svelte is better in that its state updates are triggered around the assignment operator. Which is a step towards more "native" JavaScript. However there are still issues around internal changes. You cannot use push in svelte, instead `x = [...x, newItem]` is required for the compiler to realise a update has happened. This also the case for for the `Date` instance, calling `setMonth` etc does not cause the view to be updated. With Prism I wanted to allow internal mutation in the same way JS works. So I implemented this for `Date`.

{% video "/media/date-reactivity-demo.mp4" %}

([just don't look how I implemented this](https://github.com/kaleidawave/prism/blob/aa6a4f4e7c755076666efc16a984a663885e1674/src/bundle/observable.ts#L159))

### Internal updates

In Prism 1.5.0 the Rust SSR compilation was improved so the that server render functions now append to the same buffer. The buffer can have initial capacity using the new decorator `@WithCapacity(x)`. Setting the value can improve SSR performance through avoiding reallocations. There was also some unnecessary `to_string` calls on Strings which has been removed with the help of types.

Text can now be interpolated when alongside other tags. There are fixes for getting data on nullable nodes and there has been A lot of work behind the scenes to allow for Prism components to be compiled on the browser.

### Future {#prism-future}

Prism is not designed to be the next new framework. Instead it is a implementation in attempting to fix some of the biggest issues around SSR and hydration in currently popular frontend frameworks.

One thing is that it unfortunate same name with syntax highlighting library [prism.js](https://github.com/PrismJS/prism/) which may cause some confusion. When I named the framework, "Prism" was meant to depict the single source that is *split* into the various paths (csr, ssr, bindings, hydration logic, etc). I wasn't aware of prism.js and it's prevalence until shortly after releasing it under that name. It also unintentionally a extremely similar logo to database ORM [prisma](https://github.com/prisma/prisma). If interest were to pick up then I may make features more reliable and release it under a new name. 

The compiler is a little rough around the edges. Prism will fail both silently and loudly. It is not intended for production but if you want to try out JIT hydration or Rust compilation you can try the [quickstart](https://github.com/kaleidawave/prism/blob/main/docs/quickstart.md) or fork the [HN repo](https://github.com/kaleidawave/hackernews-prism).

### Footnotes 📜 {#footnotes}

<h6 id="foot1">(1) Render to hydrate</h6>

For event listeners to be added the runtime needs to find the elements first. Many frontend frameworks do this via "rendering" their tree and comparing the result with the markup. Therefore **all** the data is required at hydration.

<h6 id="foot2">(2) Types</h6>

All values represented in the DOM are strings. `innerText` is string, `getAttribute()` returns string. So when getting the value of score from the server rendered markup it needs to be converted to `number` instance first. In order to know what instance to convert it to Prism requires to know the type. This is done using a TypeScript generic argument on the class:

```ts
// @useRustStatement #[derive(Clone, Debug, serde::Deserialize)]
export interface IStoryItem {
    id: number,
    url?: string,
    by: string,
    score: number,
    @useRustStatement(`#[serde(default)]`)
    descendants: number, // Number of kids
    @useRustStatement(`#[serde(with = "chrono::serde::ts_seconds")]`)
    time: Date,
    @useRustStatement(`#[serde(default)]`)
    kids: Array<number>,
    // This is "type" in hn api but Rust does not like "type"
    @useRustStatement(`#[serde(rename(deserialize = "type"))]`)
    storyType: "job" | "story" | "comment" | "poll" | "pollopt",
    text?: string,
    title: string   
}

class StoryPage extends Component<IStoryItem>
```

<h6 role="caption">
    The types are also used to build Rust struct definition for definite types on their render methods. <code>@useRustStatement</code> allows for adding attributes to the struct members. 
</h6>

<h6 id="foot3">(3) Non reversible expressions</h6>

Some expressions cannot be reversed. For example the `date` in markup is rendered as a relative string. From `"1 day ago"` it isn't possible to construct a `Date` instance of that value as it could be any hour, minute etc of the previous day. There are a possible `86400000` different `Date` objects which could have been rendered to say `"1 day ago"`. Information has been lost in converting it a relative string. So instead a ISO string representation of that `Date` is added as a attribute on one of the elements so the hydration logic can do `return new Date(elem.getAttribute())`. 

Prism can reverse some expressions e.g. from `/i/${id}` it produces this expression `result.slice(3)`. See [this issue](https://github.com/kaleidawave/prism/issues/11) for further details.

<h6 id="foot4">(4) Streaming</h6>

Currently the response from SSR is buffered and sent and appended as one. This isn't great as the server could start sending the first part of the markup while its waiting for the data source to respond. The first thing is that Prism doesn't have a way to mark async data (svelte has `await` blocks and marko has `Await` elements) that are probably needed to do static analysis. The second is that [fetch response streaming is not yet stable](https://web.dev/fetch-upload-streaming/). Most streaming solutions currently use web sockets. Streaming content on initial page load is a feature by the browser but doing it after the page loads for web components is only possible via [this slight hack](https://jakearchibald.com/2016/fun-hacks-faster-content/). Also Rust generators (which would be preferred) for the compiled ssr functions [are not yet stable](https://github.com/rust-lang/rust/issues/43122), *(although something could be done with closures)*. Hackernews is a bad example due to not having a direct request to their database and the latency effects from buffering are visible. Streaming is planned for the future but not available in this release.
