---
layout: post.njk
title: Definitions of web terminology
description: A bunch of definitions for terms thrown around in web development
date: 2022-03-31
image: /media/books1.jpg
includeImage: true
tags: posts
---

### Rendering

The act of turning data or state into some representation of HTML.

### Server side rendering (SSR) {#ssr}

A process which produces a string/text buffer of the HTML format by a server (a machine that is not the client). Note that this can be stored in buffers on a server as a cache or can be saved to *files* as static site generation.

### Client side rendering (CSR) {#csr}

A string/text representation of HTML or `HTMLElement`s that is created locally on the client (the same cpu, this includes web workers and service workers).

### Hydration

Hydration is the running of code which enables client side interactivity on server rendered DOM.

<!-- Typically the term encompasses the method React and many other frameworks use (**but this is not the implementation in all frontend frameworks**):

- Parsing state from a JSON blob that is sent with the server rendered markup
- Rendering DOM elements on the client as if the server rendered markup did not exist. This also runs any component initialization logic
- Pairing up client rendered DOM elements with server rendered elements and adding event listeners, making corrections. Something said is “nuke server rendered” DOM, which is something where the client rendered DOM does not match the server rendered DOM and removes it and uses the client rendered version -->

### Partial hydration / Island architecture {#partial-hydration}

If your implementation of hydration starts by walking from top level node and ends up running over the whole UI requiring deserializing **all the state** then partial hydration is identifying and instead running hydration only on dynamic trees (aka not [static trees](#static-trees)). The islands refers to the dynamic trees.

Partial hydration is a form of [dead code elimination](#dead-code-elimination), where the code being removed is anything to do with UI that doesn't change. This includes static component's render methods and any dependencies the render methods pull in. If state is also serialized as a JSON blob then partial hydration can stop serializing data used by the static trees.

The saving is a ratio of how *dynamic* the page is. Partial hydration doesn’t make the interactive parts faster just removes the costs of additional serialized state and their from static parts, so overall the page should be faster than the “hydrating” the whole page. And notes this is not a linear ratio, often dynamic parts contain larger code than the static parts (e.g. 90% static ≠ 90% performance improvement). 

Note that this architecture is difficult to implement for [SPAs](#spa) as the router is often *dynamic* and therefore so is everything below. It’s a architecture not a feature. Partial hydration / Island architecture is not related to [progressive enhancement](#progressive-enhancement)

### Progressive hydration / Lazy hydration {#progressive-hydration}

Doing the process of hydration on interaction with a component or some other time after the page load.

It is important to note that this can make things noticeably slower as interactions have to do work after interaction they would have done at idle on the page load. So this architecture really encompasses other functionality at play such as reducing JS over the wire by sending granular component code and stopping at hydrating the whole subtree which can make the component interactive sooner. 

### JIT (state) Hydration {#jit-hydration}

Lazily initializing the client's state using data present in the UI in the HTML rather than a JSON blob or additional source.

### Progressive enhancement (PE) {#progressive-enhancement}

The act of server rendering markup which has functionality using HTML features such as:

- Forms with endpoints
- Anchor tags with href

The above features are available without JS running on the client. A server should be ready to receive the browsers requests and do stuff. 

Progressive enhancement can be implemented in any framework that supports server side rendering. Although some frameworks have helpers for making this easier or the cow path. Additionally a [hydration](#hydration) step can then add event listeners to override the default browser functionality.

Note that not every interaction can be implemented using the HTML features (e.g mouse drawing on a canvas) so JS is required in many scenarios and often doing it in JS has a better experience. Forms and anchor tags both do [full page reloads](#full-page-reloads) which can disrupt state on the client (e.g. other input contents, background audio). Overriding the behavior to be a [spa](#spa) allows for transitions between and in some places can be faster as only a partial amount of the new page data needs to be changed. Sometimes using the browser functionality is easier and sometimes it is not (e.g. [post request without redirect](https://stackoverflow.com/a/28060195/10048799)).

But doing PE is better than not doing PE. The site should be as functional as it can be because JS (the hydration) may have not run yet, at all or may have failed. 

PE is disjoint from load performance. PE does not mean better performance either, using JS to only get partials from the server sends less than the content from a full page refresh thus is better performance. 

**Progressive enhancement is not [partial hydration](#partial-hydration).** 

### Design system

A collection of colour themes, component designs, layout and assets encompassing brand image and packaged up to be easily reusable throughout the site.

### Hot module reloading / swapping {#hmr}

When changes happen during development it patches the changed functions rather reload the whole content and state.

### Dynamic rendering

Server server renders pages with data on demand.

### HTML Frames

Sections of which content is purely server side rendered. Note that server components may or may not be frames if they don’t serve HTML strings. 

### Static site generation (SSG) {#ssg}

Generation of static HTML through server side rendering (or some bad methods that do client side rendering and then capture the result on a headless browser). Normally done at build time. Note that SSGs can have dynamism through client side rendering. If a tool has server side rendering then that mechanism can be used to send the HTML content to file to implement SSG. 

### Incremental static generation (ISG) {#isg}

Similar to a static site generation. Where a static site generates on build / deploy. Incremental static generation is linked to a timed interval or a hook on the change of a data source and on that event generates new pages to reflect the new data. 

### Time to interactive (TTI) {#tti}

The time to which some form of [hydration](#hydration) has finished adding event listeners with most of the functionality **ready**. 

- Event handlers are registered for most visible page elements
- **The page responds to user interactions within 50 milliseconds**

### First contentful paint (FCP) {#fcp}

The time to display content from when the page starts loading (e.g server initially responds, so this does not include the time to establish a connection). If SSR this is the time it takes to produce the HTML string and if doing purely client side rendering then the time it takes for the JS to start running and produce the elements). This also includes initial layout working and image rendering.

### Time to first byte (TTFB) {#ttfb}

How long it takes for the server to initially respond. If streaming this is the time to the first chunk. If not (aka buffering) this is the time for the content to be prepared and sent (aka a full SSR). Normally a measure of the hosting server rather.

### No-JS / zero JS {#zero-js}

Something with no JS running **ever**. This includes [3rd party scripts](#3rd-party-scripts). Again most pages require some form of JS, something that runs no JS is not necessarily better.

### Sprinkles

Using JS to add interactivity to certain parts of a server rendered UI in small amounts. (This is not [progressive-enhancement](#progressive-enhancement) as it doesn't require implement server functionality)

### 3rd party scripts

A script written out of house. Examples including Google analytics, Google tag manager etc

### Static trees

A tree which does not change

```jsx
const static_tree = <h1>Hello</h1>;
const still_static = <div>{*constant variable*}</div>;
const not_static = <h2>{new Date()}</h2>
```

`not_static` is dependant on a variable result and thus is a **dynamic tree**.

### Re-render

For VDOM or systems which need to recalculate trees after the result of a action. This term is given to the calculations for recomputing UI. Later the result of the re-render requires diffing to efficiently update the new UI.

### Fine grained reactivity

Reactivity in which knows about parts of the states and only does work in those areas.

```jsx
<h1>{title.toUppercase()}</h1>
<p>{content}</p>
```

E.g. changing `content` should not result in calculating `title.toUppercase()`

**This is to do with partial updates to state. Something which skips static trees is not really fine grained reactivity.**

Note that fine grained reactivity may include re-rendering sections which are dynamic under the state.

### Server component

Any component where its content is produced on the server either in HTML or a intermediate format.

### Memoization

The process of caching function return values against the inputs. If a function takes a long to compute the result and is rerun a lot then this can speed up getting the result as it takes a map lookup rather than a re-computation. 

A auto-memoization compiler can wrap function calls with a cache lookup and storage.

Note that this is a optimization at call sites, this can be avoided via rearranging when data is calculated and is passed through. 

This technique incurs memory overhead due needing to storing all results of the function. And for many cases a map lookup can be slower than just doing the operation. 

### Actions

Something which mutates a specific part of the state.

### Effects

Results of those actions. e.g changing a value may require updating the content element in the templating interpolation.

### Diffing

Finding differences between a existing representation and a new representation.

Diffing techniques do not always apply to VDOM. Diffing can be done on structures that do not look like DOM. Such as a flat list.

Produces a diff / difference which can be used for reconciliation.

### Virtual DOM / VDOM {#vdom}

The virtual DOM is a structure similar to the DOM. It is slimmer and has a subset of the API of the structures defined in the DOM JS spec e.g. HTMLElement. VDOM is a representation, actual DOM has functionality (e.g `.click()` isn't on VDOM structures).

### Conciliation / reconciliation {#conciliation}

This applies to virtual DOM and other representations e.g. lists.

It is the act of taking the results of the diff and updating the UI. The diff should describe the minimum amount of work to update the UI).

### CSS in JS

Some notion of writing styles in JS. Normally via object literals that look like CSS syntax. Unsure whether this covers `<style>` JSX tags and template literals...

### Frontend

What is interpreted on the client. Public and visible to all. Includes communication with backend (but not implementation). 

### Backend

Something which does not run on the client. Owned by a operator, distributes data and effects across clients. Backend includes the serving of content and HTTP responses etc

### Full stack

The combination of frontend and backend. Full stack knowledge is knowing both sides of the network. A full stack framework has features spread across frontend and backend

### Single page application (SPA) {#spa}

A page which does not use the browsers built in navigation to do page transitions. **It is does not mean that there is only one page, only that the browser internally thinks it on the same page**. 

Can be faster as only have to update regions between pages, can retain state between navigations. Implementations should use the history api so the browser's back buttons still function. New page contents can be generated using client side rendering or by retrieving and injecting server rendered content (e.g. turbolinks).

A SPA can be server rendered initially.

This architecture makes it simple to build a [PWA](#pwa).

### Multi page application (MPA) {#mpa}

A page of which links cause inbuilt browser navigation. Pages are exclusively server rendered (but parts of them can be changed via the client).

### Progressive web application (PWA) {#pwa}

This encompasses a lot but the main points are that it is built using web technologies but can do the following:

- Installable (act like a native app)
- Work offline (functionality does not require talking to server *all* the time, *some* content stored on device)
- Doesn’t have to but uses several native apis: camera, clipboard, background fetch, push notifications

### Static

Does not change.

### Dynamic

Does change.

### DOM (Document object model) {#dom}

The API for HTML elements. Every HTML element has some attributes and some children either being more elements, text or comments. DOM elements can also be interacted with things like `.click()`.

### Shadow DOM

A special form of DOM which is encapsulated inside the element. The internals are isolated from the whole DOM so that outside JS and CSS cannot affect the internals. CSS defined internally is scoped to the internal tree. 

### Universal JavaScript / Universal rendering {#universal-javascript}

Running JavaScript produced that is derived or is the same source on both the client AND the server.

### Isomorphic JavaScript

Same meaning as [universal JavaScript](#universal-javascript).

Use of this should be discouraged as the (proper) definition of *isomorphic* in category theory doesn't make sense here. 

### Meta framework

A framework which is built upon one or more existing frameworks and wraps functionality. For example nextjs which extends React.

### Templating language

A language which can describe how to build some form of markup. 

### Imperative templating

A template language which has imperative notions of declarative source.

### Streaming

Something of which can start working without the whole of the resource being present. e.g a streaming renderer can start returning results before the whole thing has been rendered. Streaming hydration can start hydrating nodes before all the nodes are on the client. 

### Static analysis

Something in which interpretations can be made from reading source.

Something which is statically analyzable is something of which behavior can be worked out ahead of time. It should be noted that somethings that are deemed not to be statically analyzable can be made statically analyzable by introducing constraints on what can be written. It should also be used with caution as somethings named under statically analyzable actually are but whose implementation is incredible complex to build.  

### Markup

Some kind of language which is centred on content first. Markdown, HTML and yml are based on content. 

### Compiler

A program which:

- Parses input into abstract syntax trees, concrete syntax trees or some other source based IR
- Transforms IR
- Returns some evaluatable result or a collection of errors found

“compiling” is a compiler at work.

### Transpiler

Similar to a compiler it is a source to source compiler e.g the output is similar to the input. 

A transpiler is still a compiler and note a transpiler is not anymore lean than a compiler.

“transpiling” is a transpiling at work.

### Intermediate representation (IR) {#ir}

A more abstract representation of the source, may not be reversible to the original source. e.g operation canonicalization.

### Serverless

Non centralized computation. Similar to a pure function (without side effects) these should be small map like functions.

Note this is still run on serverless just that it abstracts away a lot of the behaviors of centralized server computations.

### API

The definition / interface for interaction with something.

### Headless browser

A browser controlled by a server rather than a user. Examples of headless browser tools includes puppeteer, selinum, playright.

### Tooling

A single or many programs that are used to build a program.

<!-- ### Hoisting

The use and calling of functions (and vars) before being defined. -->

### Framework

Something which acts as the entry point to a program. The framework interprets and operates over user code. 

### Library

Something which exposes functions which can called and returns results.

<!-- ### Primitive

Something of which its internals cannot be read -->

### Bundling

Concatenation of source code from multiple sources and files into one or more files.

### Dead code elimination (DCE) {#dead-code-elimination}

Finding code that is never ran or has no effect and making sure its representation doesn't end up in the final output.

### Tree shaking

Tree shaking is a subset of DCE which mostly refers to removing top level function declarations (from the abstract syntax tree, which is what the tree part refers to).

### (whitespace) Minification {#minification}

Remove **unnecessary** whitespace (new lines, tabs, spaces) from the source.

### Infrastructure

The whole operation or managing and running the program.

### Standard

A API formalized in a specification and implemented by other parties.

### Type checking

Validating that source code lines up with type definitions.

### Type annotation

A piece of syntax which associates a type with a term.

### Type inference

Identifying a type without using information from a type annotation.