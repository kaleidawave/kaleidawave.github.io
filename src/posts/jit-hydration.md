---
layout: post.njk
title: JIT Hydration
description: JIT hydration is a ultra efficient technique that avoids rerenders and duplicated state when building universally rendered sites
date: 2020-11-24
tags: posts
---

What is hydration? Hydration is the act of making statically rendered markup interactive.

But what is interactive? Typically this is attaching event listeners and setting the scene for those listeners to be able to change the view. The aim of hydration is to make the page indifferent to it being client side rendered. 

So how do frameworks add event listeners to the existing markup?

Many frameworks work of a render-to-hydrate system. The rendering identifies where the elements with listeners are. And from knowing their position they can attach to existing markup. To render the application first requires state. For example with React:

![react hydration](https://dev-to-uploads.s3.amazonaws.com/i/okd0z2f1p9eug5od0esc.gif)

(Something like that I think)

But the issue here is to add the event listeners the component needs to be *rendered* and for it to be rendered it needs to have some data / state.

This is where state hydration (a subset of hydration) comes in. In order to render this "frame" it needs some data.

Standard client side rendered sites would make a http request to the backend api to get the data on initial mount. But this is a separate request, there may have been changes to the data in the time between rendering the page, getting it to the client and the client parsing and running the script. The difference in the data could break hydration. The other issue is that this is a totally new request and (without backend caching) would have to make another request to the database which is expensive.

So the solution a lot of frameworks use is to send the data down as a JSON blob with the request.

![double data](https://dev-to-uploads.s3.amazonaws.com/i/xf1k2jb3eno87otpjeyf.png)

[And this is bad because the data is effectively sent down twice](https://youtu.be/CQaDl9Fu0W0?t=365)

There is also the fact JSON is difficult to work with due to its difficult to represent complex types such as `Date` and other things like cyclic references etc. Also that some JSON blobs are quite large especially if there are long lists of objects. And using raw JS object literals can be slow [due to the way they are parsed](https://www.youtube.com/watch?v=ff4fgQxPaO0). 

Additionally some parts of this object where not used in the render and so will not be needed in the re-render. In a large number of cases this object contains more data than was needed. There can be [work done with Proxies](https://twitter.com/slightlylate/status/1309975133067509760) to trim leaf nodes but there doesn't seem to be any automatic approaches.

Time to interactive can be slow because the whole state has to be parsed, evaluated and the application rendered before a single event listener has been added.

The slow hydration problem also occurs for static site generation as well. Any sort of process of generating markup before hand (which is beneficial) where that markup needs client side reactivity needs to do some sort of hydration.

This issue is something framework authors and developers are aware of and actively working on:

- [Evan You, Creator or vue](https://twitter.com/youyuxi/status/1274834284826763265)
- [Google post on issue](https://developers.google.com/web/updates/2019/02/rendering-on-the-web#rehydration-issues)

[Partial hydration](https://medium.com/@luke_schmuke/how-we-achieved-the-best-web-performance-with-partial-hydration-20fab9c808d5#94ad) is one technique that is being considered. Using partial hydration in a react app you split up the application so there are multiple react sources. Instead of a single `React.hydrate` call there are multiple invocations under some components. This way you can prioritize reactive elements and ignore static elements. See popular rfc from these frameworks; [svelte](https://github.com/sveltejs/svelte/issues/4308), [react](https://github.com/facebook/react/pull/14717), [angular](https://github.com/angular/angular/issues/13446).

But most implementations seems quite manual to implement. It also seems difficult to how this plays out with what is a static element and what needs to be reactive. 

### But today I'll introduce a different approach: ~ JIT Hydration

The ideal hydration would be prioritizing adding event listeners above everything. The only need for state at hydration is for generating the vdom for matching up event listeners. But we could do something at build time to mark elements with events and at runtime add the events without knowing there position and existence in the tree.

State still needs to be hydrated to be accessible at the JS runtime. But to prevent the double data problem the values would be hydrated from the rendered DOM. JIT would work only hydrating state in when needed.

And this is what I have written into my own framework [Prism](https://github.com/kaleidawave/prism). One of the features is JIT hydration:

![Alt Text](https://dev-to-uploads.s3.amazonaws.com/i/tdqgpuufndw3hfke8s6z.gif)

And this is working quite well here on my [hacker news clone](http://40.115.126.159/)

![Alt Text](https://dev-to-uploads.s3.amazonaws.com/i/q9hgel93n4ebai7ez42b.gif)

It is compiled with Prism and all the rendered data can be JIT hydrated in while none of the payloads send any sort of JS(ON) state blobs. 

You can read more about the Hackernews clone [here](/posts/hackernews-clone-prism-rust)

JIT hydration has the effect of full hydration at a significantly lower cost on client than full or partial hydration.

### So what are the benefits of JIT hydration:

- Prioritizes adding events, does not need state to add event listeners
- State loading is deferred until needed
- Loading in state is done on a per property basis rather than everything at once so the lazyness does not come at a significant cost
- TTI (time to interactive) increases ⏫⏫
- Smaller payload sizes due to not needing state tree
- Resolved complications for objects that cannot be represented in JSON (DateTime 👀)
- Although values in the DOM are all strings Prism converts the strings to the correct types. As can been seen from the `id` and `score` value on each story in the state.
- Values are cached after being pulled in during hydration
- The get logic is invariant and can be cached between requests. The JSON blob is not.

### Conclusion:

JIT hydration sounds good on paper but it is difficult to implement. For it to work effectively there needs to be more complex work done at build time. To establish where data comes from it requires compiling bindings rather than locating it at runtime. So runtime limited frameworks like React will not be able to implement such but frameworks that do some work at build time e.g. svelte or vue may be able to do something here.

There are also complications as now components have a virtualized state. Also the fact that a child can have state before its parent does. To do the immediate event listeners addition without state there needs to be markers in the markup as where elements are. Prism does this with a combination of classes added at build time and web components. Using these markers alleviates the need to "render" the whole application.

There is also complexities around values that are not represented literally in the DOM. For example the `href` on the link tags are interpreted as `/i/${id}`. Prism has a limited expression reversal and here creates a `slice` expression to get the `id` value. But for more complex expressions it breaks down, especially for not 1:1 expressions where it is impossible.

So yeah, this is super early and experimental stuff. If you have any questions or feedback it would be great to leave them in the comments.

You can follow me and the development of Prism [@kaleidawave](https://twitter.com/kaleidawave)

<h3 class="note">
    Originally posted on <a href="https://dev.to/kaleidawave/jit-hydration-4b62">dev.to</a>
</h3>
