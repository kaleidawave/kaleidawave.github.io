---
layout: post.njk
title: Hacker News Clone with Prism & Rust
description: Building a universally rendered Hacker News Clone using Prism, Rust and Actix-Web
image: /media/banners/hackernews-clone.png
date: 2020-11-10
tags: posts
---

Last week I recreated the [Hacker News site](https://news.ycombinator.com/news). It is built as a isomorphic site with a Prism compiled frontend and a Rust backend. In this post I will illustrate some of the benefits that using [Prism compiler](https://github.com/kaleidawave/prism) has on this site.

### Isomorphic sites with a Rust backend {#rust}

Currently most sites are client side rendered apps built with a framework. Client side frameworks make development easier by using a more declarative programming style. Using the client runtime can add more reactive interactions without going back to the network. Client side frameworks make SPA’s easier to develop.

However a pure client side site lacks fast start up times. Before any content is added to the DOM JavaScript must be downloaded, parsed and executed. This relies on the the network speed and speed of the client device. There is also the problem that if this process fails then you end up with a white page without any content. Another problem is that each request returns the same empty HTML so there are problems with search engine indexing and link metadata previews between different pages if the bots don't evaluate the JS.

Client side rendering is acceptable for mostly interactive sites (e.g. [Figma](https://www.figma.com/)), but does not suit more contentful sites where content is more important than reactivity.

So instead of a server can instead do server side rendering (SSR) to generate the initial page. SSR fixes the above problems as there is no reliance of the client runtime for generating content. SSR responses contain relevant non-unique markup so search engine indexers and link metadata bots can work without them running JS.

This is true for the [Hacker News site](https://news.ycombinator.com/news) that renders pages on the server, which is a good architecture as reading posts and comments is more important than interactions.

Server side rendering a client side code is already being down with in frameworks. [react-server/dom](https://www.npmjs.com/package/react-dom) has `renderToString`, and [Svelte components have a similar method](https://svelte.dev/docs#Server-side_component_API). Then there are isomorphic frameworks like [Nextjs](https://github.com/vercel/next.js) and [sapper](https://github.com/sveltejs/sapper) which tie this all in together.

<h3 class="center">However the above methods require a JavaScript runtime</h3>

So in my own framework I experimented with the feature to compile views to Rust functions. All `.prism` components are compiled to native Rust string concatenation functions. This has many benefits:

- Single source, no need to rewrite for different server languages
- Changes to `.prism` components are reflected and kept inline with the Rust methods
- Client side markup and server side markup are kept in sync preventing issues when making components interactive

It also compiles across the `interface` definitions to Rust's `struct` definitions, which retains the strong type safety. The Rust compiler will pick up any other issues with the outputted Rust functions. This is a step above [handlebars](https://handlebarsjs.com/) where type errors are left to runtime.

It is not as complete as Nextjs as where it builds the whole backend for you. Prism only builds out functions which then must be connected up. But I prefer this design as getting data on the server and the client is very different (not for this example but for applications where you have full control over the stack). Prism is not really a full stack framework as while it exposes the render methods in Rust modules, it doesn't generate the routing needed in Rust.

Prism hacker news uses actix-web under the hood which is in the [top 5 fastest backend frameworks in the tech empower benchmarks](https://www.techempower.com/benchmarks/#section=data-r19), of that list raw NodeJS server places 152nd. According to the benchmarks it makes actix-web 7x faster than a raw nodejs server.

For this example it doesn’t really make much of a difference as the biggest time here is making HTTP requests to the [HN api](https://github.com/HackerNews/API). A single request to the homepage takes 11 http requests with a lot of them being chained.

Aside from the speed improvements it also means that if you have written your REST api in Rust then you can add SSR to your site reusing the same server and logic rather than having to rewrite server side data fetching in a new nodejs server.

It is already possible to server render SPAs in other languages:

- Through calling directly to v8 api. However, this has a bit of overhead / isn’t fast as compiling to native. It lose strong typing and can be complex to integrate.
- Rewriting the client view code in a templating engine supported in the language. As well as taking a lot of work to initially, it is difficult to maintain as to frontend markup views must be reflected in the other template. Mismatch can lead to issues when the frontend logic gets a different response to what it was expecting from backend the backend.

### JIT hydration {#jit-hydration}

When building isomorphic sites it often makes the frontend more confusing. Now the frontend it is not the start of the world and there is existing markup. The biggest issue from this is booting up state on the frontend. With both server and client rendered DOM the view is the same but the JS state is not there on server responses. Getting the state in JS by doing a data fetch is not good as it may be out of sync with what the server content is. So the approach used by most SSR frameworks is to send down a JSON or JS blob in a script tag that contains the JS object used to generate the markup response.

This is a common practice and can be seen on nytimes where (at the time of this being written) ~75% of the home page response is the state loaded into the `window.__preloadedData` variable:

{% image "/media/new_york_times_preload_data.png", "lots of json" %}

There are a few issues with this approach:

- Some of the object is not used. There some implementations that use Proxies to identify unused “leaves” but this is complex and expensive to do.
- Most of the data is already sent down in the markup.
- JSON lacks ability to represents types other than string, number, boolean, object and array. This is biggest seen with DateTime.

Prism’s approach ditches any sort of JSON or JS blob and the server response only sends markup:

```html
<!DOCTYPE html>
<html lang="en">
    <head>
        <script type="module" src="/bundle.1w99.js"></script>
        <link rel="stylesheet" href="/bundle.lxt.css">
        <title>Hacker News</title>
        <meta name="description" content="Prism & Rust based HN clone">
        ...
    </head>
    <body>
        <router-component>
            <main-layout data-ssr>
                <header>
                    ...
                </header>
                <main class="p900">
                    <index-page data-ssr>
                        <ol class="pwf4">
                        <li>
                            <story-preview data-ssr >
                                <div class="buttons">
                                    <button class="p1lb2" disabled>&#9650;</button>
                                    <button class="plwi" disabled>&#9660;</button>
                                </div>
                                <div>
                                    <h2 class="pavi">
                                        <a ... class="p1kxi" href="...">
                                            Fire declared in OVH SBG2 datacentre building
                                        </a>
                                    </h2>
                                    <span>
                                        <span class="pxwh">660<!----> points | by</span>
                                        <a class="p1ztd" href="..."> 
                                            <!---->finniananderson<!----> | 
                                        </a>
                                        <a class="pos3" href="...">
                                            304<!----> comments
                                        </a>
                                    </span>
                                </div>
                            </story-preview>
                        </li>
                        ...
                        </ol>
                    </index-page>
                </main>
                <footer>
                    ...
                </footer>
            </main-layout>
        </router-component>
    </body>
</html>
```

But can still get the state of the application at runtime:

```js
> JSON.stringify(document.querySelector("index-page").data)
```

```json
{
    "stories": [
        {
            "url":"http://travaux.ovh.net/?do=details&id=49471&",
            "title":"Fire declared in OVH SBG2 datacentre building",
            "score":660,
            "by":"finniananderson",
            "id":26407323,
            "descendants":304
        },
        ...
    ]
}
```

So how does it do this?

As Prism is a compiler, it knows the bindings at build time. From that it can compile in getters for each property that accesses the DOM. Once values are retrieved from the DOM they are cached in the component state, and will act the same way as if the data was instantiated on the client.

The runtime does this in quite a special way as to be efficient. Getting the data is only done once that member is evaluated, rather on document / component load. If you evaluate `temp1.data.stories[2].title` it will only load in the 3rd story, and from the story only the title property rather than bringing in every story and constructing the whole state (not that the getting the state from the HTML is really expensive, in practice getting the whole state via JSON took 6ms. But in applications with more than 10 stories on the home page the improvement is visible).

Some of the advantages of JIT hydration:
- Smaller HTML payload sizes.
- Simplicity, all a component needs to have data is SSR DOM content.
- Complications for objects that cannot be represented in JSON (DateTime 👀).

Although values in the DOM are all strings, Prism converts the string to the correct types. As can been seen from the `id` and `score` value on each story in the state.

Recreating state from the rendered markup is not a new thing. Many existing SSR sites manually write JS in the runtime script to get values. The actual HN site does this in its vote logic to where it pulls in the story id from the elements id:

```js \2
function vote(ev, el, how) {
  var id = el.id.split(/_/)[1];
  var up = $('up_' + id);
  vis(up, how == 'un');
```

But Prism automates this process for a declarative input. In contrast to the about logic in `hn.js`, which is hand written and relies on the fact that the server rendered element's id includes the id of the post.

### Bundle size

The JS bundle for hacker news is 12.6kb uncompressed (3.5kb Gzip or 3.2kb Brotli). This includes:
- All the render logic for the pages
- All the reactivity
- A single page router
- All the client data fetching logic

Actual HN runs on ~4kb of non compressed JS but then it is not a spa or framework built so I don’t think there is any comparison with it. On the other hand the Svelte HN implementation runs on 30kb of JS (although it doesn’t seem to be minified). But when it comes to these small numbers it doesn’t really matter, as long as its under 50kb of JS its pretty responsive.

Coming back to the size, with any abstraction or automated approach there is bound to be more JS outputted than writing it out by hand. Prism automates a lot of stuff, and provides the declarative approach that exists in all other client side frameworks while keeping the bundle size very low:

```html
<template>
    <div #html="text"></div>
    <span class="by">by {by}</span>
    <ul class="sub-comments" #for="const subComment of subComments">
        <li>
            <This $data="subComment"></This>
        </li>
    </ul>
</template>

<script>
    // @useRustStatement #[derive(Clone, Debug, serde::Deserialize)]
    export interface IComment {
        by: string,
        id: number,
        @useRustStatement(`#[serde(default)]`)
        text: string,
        @useRustStatement(`#[serde(default)]`)
        subComments: Array<IComment>,
        @useRustStatement(`#[serde(default)]`)
        kids: Array<number>
    }

    const maxCommentDepth = 3;

    export class Comment extends Component<IComment> {
        static async getComment(id: number, depth = 1) {
            const endpoint = `https://hacker-news.firebaseio.com/v0/item/${id}.json`;
            const request = await fetch(endpoint);
            const comment = await request.json();
            if (!comment) throw Error(`Could not find comment under id ${id}`);
            if (comment.kids && depth < maxCommentDepth) {
                const subComments = comment.kids
                    .slice(0, 3)
                    .map(kidID => Comment.getComment(kidID, depth + 1));
                comment.subComments = await Promise.all(subComments);
            } else {
                comment.subComments = [];
            }
            return comment;
        }
    }
</script>

<style>
    & {
        display: block;
        margin: 10px 0;
    }

    div {
        font-size: 14px;
    }

    span.by {
        display: block;
        margin-top: 12px;
        font-style: italic;
        font-size: 12px;
    }

    ul.sub-comments {
        padding-left: 24px;
    }
</style>
```

When Prism's HN app launches up, the custom elements connected events fire and add event listeners on to the existing markup. Here the upvote and downvote buttons on the story preview are connected as event listeners. Prism recognizes that the server is not the client and all elements with events will be server rendered with the disable attribute (which is removed once the listener is added).

When the button is clicked, the upvote method will fire and inside it will increment `this.data.score`. If the value is not already in the data cache it will be hydrated in. The increment operator will then fire a set which under the hood fires a imperative DOM call to update the view and the view will now show score + 1 points.

Prism also has a built in static router. Clicking on the comments anchor tag will route to that stories page. Also this is just a regular anchor tag under the hood so if the JS fails it will do a regular redirect and hit the server.

SPA routing has the benefits over the MPA that HN is. On a redirect it only has to load the data for that new view in and not the whole markup. This can reduce payload over the server. On redirecting the HN header is retained in the DOM and only the page is switched out. Not used here but also animations can be done rather than a flash of content. It also means that this site works without SSR and can be cached in a service worker.

<hr>

> This is only experimental at the moment, there is a lot of stuff hacked together in the compiler to get this example to work. The compilation is shaky at best and only works for simple examples such as this. This is not a drop in replacement for a nextjs site. And lacks a lot of the reactivity that React, Vue and Svelte have to offer.
>
> For now this is a proposal and a experiment to see whether there are improvements that can be made in this.

### Future

One improvement that would improve page response times is streaming the document to the client. Currently the server rendered page is only sent to the client once the whole server response has been built. Using streaming, the client here would get the header to render in before the backend has even hit the HN api. With each backend request the response could be immediately sent to the client to be rendered in. This would also work really well with the JIT hydration.

With the addition of Rust to the target outputs for Prism it proves that there is the ability to construct SSR functions for other languages. The addition took less than 2 weeks to implement and a lot of that was opening up the pipeline to be less language oriented (and a lot of wrangling with Rust’s memory safety model). There is a opportunity to add support for more languages if this is a beneficial feature but I think the Rust implementation needs to be scrutinized and tightened up before that happens.

This clone is also missing a number of features from the actual version that I would still like to implement. But I only spun this example up in a week and before that I had no experience with Rust. Also during development Prism was missing a few features such as recursive components (used for the comments) and unsafe html (HN text field includes raw HTML) so I added them for version 1.3.0.

For now you can clone the clone and try it out here: [kaleidawave/hackernews-prism](https://github.com/kaleidawave/hackernews-prism).

For a JS based isomorphic site there is [kaleidawave/prism-ssr-demo](https://github.com/kaleidawave/prism-ssr-demo) and can be run on [replit](https://repl.it/github/kaleidawave/prism-ssr-demo).
