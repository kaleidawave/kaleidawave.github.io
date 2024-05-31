---
layout: post.njk
title: Definitions of web terminology
description: A bunch of definitions for terms thrown around in web development
date: 2022-03-31
editDate: 2023-04-30
image: /media/banners/web-terminology.png
tags: posts
---

### Rendering

The act of turning data or state into some representation of HTML.

### Server-side rendering (SSR) {#ssr}

A process that produces a string/text buffer of the HTML format by a server (a machine that is not the client). Note that this can be stored in buffers on a server as a cache or can be saved to *files* as static site generation.

### Client-side rendering (CSR) {#csr}

A string/text representation of HTML or `HTMLElement`s that is created locally on the client (the same CPU, this includes web workers and service workers).

### Hydration

Hydration is the code that [associates the state of an item with an existing object](https://stackoverflow.com/questions/6991135/what-does-it-mean-to-hydrate-an-object). On the web, this refers to creating state in JS that matches [server-side rendered](#ssr) DOM, which then enables client-side interactivity. It has origins in [database](https://www.snaplogic.com/glossary/data-hydration) and originates from the [hydrate project from 2006](https://hydrate.sourceforge.net/).

### Partial hydration/Island architecture {#partial-hydration}

Partial hydration (for a full page) is only hydrating certain dynamic elements (not [static trees](#static-trees)). The islands refer to the dynamic trees.

Partial hydration is a form of [dead code elimination](#dead-code-elimination), where the code being removed is anything to do with static UI. This includes static components render methods and any dependencies those render methods pull in. If the state is also serialized as a JSON blob then partial hydration can remove data used by static trees.

Partial hydration is an architecture, not a feature. Partial hydration/Island architecture is unrelated to [progressive enhancement](#progressive-enhancement).

### Progressive hydration/Lazy hydration {#progressive-hydration}

Doing the process of hydration on interaction with a component or some other time after the page load.

### Progressive enhancement (PE) {#progressive-enhancement}

The act of server rendering markup that has functionality using HTML features such as:

- Forms with endpoints
- Anchor tags with href

The above features are available without JS running on the client. A server should be ready to receive the browser's requests and do stuff.

Progressive enhancement can be implemented in any framework that supports server-side rendering. Although some frameworks have helpers for making this easier or the cow path. Additionally, the [hydration](#hydration) step can then add event listeners to override the default browser functionality. *progressive enhancement is not [partial hydration](#partial-hydration).*

Note that not every interaction can be implemented using the HTML features (e.g. mouse drawing on a canvas) so JS is required in many scenarios and often doing it in JS has a better experience. Forms and anchor tags both do full page reloads which can disrupt the state present on the client (e.g. other input contents, background audio).

But doing PE is better than not doing PE. The site should be as functional as it can be because JS (the hydration) may have not run yet, at all or may have failed.

### Design system

A collection of colour themes, component designs, layouts, and assets encompassing brand image and packaged up to be easily reusable throughout the site.

### Hot module reloading/swapping {#hmr}

When changes happen during development it patches the changed functions rather than reloading the whole content and state.

### Dynamic rendering

The server renders pages with data on demand.

### HTML Frames

Sections of which content is purely server-side rendered. Note that server components may or may not be HTML frames if they don't serve HTML strings.

### Static site generation (SSG) {#ssg}

Generation of static HTML through server-side rendering (or some bad methods that do client-side rendering and then capture the result on a headless browser). Normally done at build time. Note that SSGs can have dynamism through client-side rendering. If a tool has server-side rendering then that mechanism can be used to store the HTML content in a file to implement SSG.

### Incremental static generation (ISG) {#isg}

Similar to a static site generation. Where a static site generates on build/deploy. Incremental static generation is linked to a timed interval or a hook on the change of a data source. The hook fires an event that generates new pages to reflect the new data.

### Time to interactive (TTI) {#tti}

The time to it takes to add event listeners with most of the functionality **ready**.

- Event handlers are registered for the most visible page elements
- The page responds to user interactions within 50 milliseconds

### First contentful paint (FCP) {#fcp}

The time to display content from when the page starts loading (e.g. server initially responds, so this does not include the time to establish a connection). If SSR this is the time it takes to produce the HTML string and if doing purely client-side rendering then the time it takes for the JS to start running and produce the elements. This also includes initial layout working and image rendering.

### Time to first byte (TTFB) {#ttfb}

The time it takes for the server to initially respond. If streaming, this is the time for the first chunk. If not (aka buffering) this is the time for the content to be prepared and sent (aka a full SSR). Normally a measure of the hosting server rather.

### No-JS/zero JS {#zero-js}

Something with no JS running **ever**. This includes [3rd party scripts](#3rd-party-scripts). Again most pages require some form of JS, something that runs no JS is not necessarily better.

### Sprinkles

Using JS to add interactivity to certain parts of a server-rendered UI in small amounts. (This is not [progressive enhancement](#progressive-enhancement) as it doesn't require implementing server functionality)

### 3rd party scripts

A script that is written *out of house*. Examples include Google Analytics, Google Tag Manager, etc

### Static trees

A tree that does not change/depend on variable data

```jsx
const static_tree = <h1>Hello</h1>;
const still_static = <div>{*constant variable*}</div>;
const not_static = <h2>{new Date()}</h2>
```

`not_static` is dependent on a variable result and thus is a **dynamic tree**.

### Re-render

For VDOM or systems that need to recalculate trees after the result of an action. This term is given to the calculations for recomputing UI. Later the result of the re-render requires diffing to efficiently update the new UI.

### Fine-grained reactivity

Reactivity in which knows about parts of the states and only does work in those areas.

```jsx
<h1>{title.toUppercase()}</h1>
<p>{content}</p>
```

E.g. changing `content` should not result in calculating `title.toUppercase()`

**This is to do with partial updates to the state. Something that skips static trees is not really fine-grained reactivity.**

Note that fine-grained reactivity may include re-rendering sections that are dynamic under the state.

### Server component

Any component where its content is produced on the server either in HTML or an intermediate format.

### Memoization

The process of caching function return values against the inputs. If a function takes a long to compute the result and is rerun a lot then this can speed up getting the result as it takes a map lookup rather than a re-computation.

An auto-memoization compiler can wrap function calls with a cache lookup and storage.

Note that this is an optimization at call sites, this can be avoided via rearranging when data is calculated and passed through.

This technique incurs memory overhead due to the need to store all results of the function. And for many cases a map lookup can be slower than just doing the operation.

### Actions

Something that mutates a specific part of the state.

### Effects

Results of those actions. e.g. changing a value may require updating the content element in the templating interpolation.

### Diffing

Finding differences between an existing representation and a new representation.

Diffing techniques do not always apply to VDOM. Diffing can be done on structures that do not look like DOM. Such as a flat list.

Produces a diff/difference that can be used for reconciliation.

### Conciliation/reconciliation {#conciliation}

This applies to virtual DOM and other representations e.g. lists.

It is the act of taking the results of the diff and updating the UI. The diff should describe the minimum amount of work to update the UI).

### CSS in JS

Some notion of writing styles in JS. Normally via object literals that look like CSS syntax. Unsure whether this covers `<style>` JSX tags and template literals...

### Frontend

Frontend is what is interpreted by the client. Public and visible to all. Includes communication with backend (but not implementation).

### Backend

Something that does not run on the client. Owned by an operator, distributes data and effects across clients. The backend includes the serving of content and HTTP responses etc

### Full stack

The combination of frontend and backend. Full stack knowledge is knowing both sides of the network. A full-stack framework has features spread across frontend and backend

### Single page application (SPA) {#spa}

A page that does not use the browser's built-in navigation to do page transitions. **It does not mean that there is only one page, only that the browser internally thinks it is on the same page**.

Can be faster as only have to update regions between pages, and can retain state between navigations. Implementations should be using the history API so that the browser's back buttons still function. New page contents can be generated using client-side rendering or by retrieving and injecting server-rendered content.

A SPA can be server rendered initially and this architecture makes it simple to build a [PWA](#pwa).

### Multi page application (MPA) {#mpa}

A page of which links cause inbuilt browser navigation. Pages are exclusively server-rendered (but parts of them can be changed via the client).

### Progressive web application (PWA) {#pwa}

This encompasses a lot, but the main points are that it is built using web technologies but can do the following:

- Installable (act like a native app)
- Work offline (functionality does not require talking to a server *all* the time, *some* content is stored on the device)
- Doesn't have to but uses several native APIs: camera, clipboard, background fetch, push notifications

### Static

Cannot change.

### Dynamic

Can change.

### DOM (Document object model) {#dom}

The API for HTML elements. Every HTML element has some attributes and some children either being more elements, text, or comments. DOM elements can also interact with methods like `.click()`.

### Shadow DOM

A special form of DOM that is encapsulated inside the element. The internals of shadow dom are isolated from the whole DOM so that outside JS cannot reference and CSS cannot affect. CSS defined internally is scoped to the internal tree.

### Virtual DOM/VDOM {#vdom}

The virtual DOM is a structure akin to the DOM. It is slimmer and has a subset of the API of the structures defined in the DOM JS spec e.g. `HTMLElement.` VDOM is a *virtual* representation of the document, actual DOM references the document (e.g. `.click()` isn't on VDOM structures).

It is used to add to or update the existing actual DOM/UI.

### Universal JavaScript/Universal rendering {#universal-javascript}

Running JavaScript produced that is derived or is the same source on both the client AND the server.

### Isomorphic JavaScript

Same meaning as [universal JavaScript](#universal-javascript).

Use of this should be discouraged as the (proper) definition of *isomorphic* in category theory doesn't make sense here.

### Meta framework

A framework that is built upon one or more existing frameworks and wraps functionality. For example, nextjs that extends React.

### Templating language

A language that can describe how to build some form of markup.

### Imperative templating

A template language that has imperative notions of a declarative source.

### Streaming

Streaming is incremental sending parts enabling work to start happening without the whole of the resource being present. e.g a streaming renderer can start returning results before the whole thing has been rendered. Streaming hydration can start hydrating nodes before all the nodes are on the client.

### Static analysis

Something that is statically analyzable is something of which behaviour can be worked out ahead of time. It should be noted that some things that are deemed not to be statically analyzable can be made statically analyzable by introducing constraints on what can be written. It should also be used with caution as some things named under statically analyzable are but whose implementation is incredibly complex to build.  

### Markup

Some kind of language that is centered on content first. Markdown, HTML, and YML are based on content.

### Compiler

A program that:

- Parses input into abstract syntax trees, concrete syntax trees, or some other source-based IR
- Transforms IR
- Returns some evaluatable result, or a collection of errors found

"compiling" is a compiler at work.

### Transpiler

Similar to a compiler it is a source-to-source compiler. Source to source meaning the output is in the same format as the input. A transpiler is a subset of compilers.

"transpiling" is a transpiler at work.

### Intermediate representation (IR) {#ir}

A more abstract representation of the source, may not be reversible to the original source. e.g. operation canonicalization.

### Serverless

Non-centralized computation. Similar to a pure function (without side effects) these should be small map-like functions.

Note this is still run on serverless just that it abstracts away a lot of the behaviours of centralized server computations.

### API

The definition/interface for interaction with something.

### Headless browser

A browser that is controlled by a server rather than a user. Examples of headless browser tools include puppeteer, selinum and playright.

### Tooling

A single or a collection of programs that are used to build a program.

### Hoisting

The use of functions before their definition in the source program.

### Framework

Something that acts as the entry point to a program. The framework interprets and operates over user code.

There are several kinds:
- Backend/HTTP frameworks
- Frontend frameworks
- Parser frameworks
- Test frameworks
- Benchmark frameworks

#### HTTP framework

An abstraction for a server in receiving HTTP requests and returning HTTP responses. Examples: [express](https://github.com/expressjs/express), [oak](https://github.com/oakserver/oak) and [axum](https://github.com/tokio-rs/axum).

#### Frontend framework

Code that only executes on the frontend

#### Fullstack framework

Code that only executes on the frontend and backend

### Library

Something that exposes functions that can be called and returns results.

### Primitive

Something of which its internals cannot be read.

### Bundling

Concatenation of source code from multiple sources and files into one or more files.

### Dead code elimination (DCE) {#dead-code-elimination}

Finding code that is never run or has no effect and making sure its representation doesn't end up in the final output.

### Tree shaking

Tree shaking is a subset of DCE that mostly refers to removing top-level function declarations (from the abstract syntax tree, which is what the tree part refers to).

### (whitespace) Minification {#minification}

Remove **unnecessary** whitespace (new lines, tabs, spaces) from the source.

### Infrastructure

The whole operation or managing and running the program.

### Standard

An API that is formalized in a specification and implemented by other parties.

### Type checking

Validating that source code lines up with type definitions.

### Type annotation

A piece of syntax that associates a type with a term.

### Type inference

Identifying a type without using information from a type annotation.

### Immutable

Cannot change

### Mutable

Can change

### Cache

A map like data structure that may or may not contain an already processed or downloaded asset
