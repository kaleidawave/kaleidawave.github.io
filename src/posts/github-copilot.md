---
layout: post.njk
title: GitHub copilot
description: ""
date: 2021-07-05
tags: posts
---

Last week GitHub announced [copilot](https://copilot.github.com/). It's a tool built on [GPT-3](https://en.wikipedia.org/wiki/GPT-3) that can transform high level statement commands into catered snippets to insert into the source. 

Coding is hard and in particular time consuming. Writing the exact implementation of what you want isn't easy and normally requires reading over a large surface area. Code needs to be exact and isn't forgiving, one letter out and it's game over (I encounter `JSON.stringlify` all the time). And with APIs it is often a case of checking the docs and having to context switch out of editing source and into long pages on MDN. 

So its understandable why something like copilot exists. Instead of looking up the docs or a stack overflow question it just inserts it into the page for you. Even if you knew what you were going to write it can insert hundreds of characters into the editor in milliseconds. It's great because you stay in your editor and you don't have to convert you attention to trawling stack overflow answers. Even if you knew exactly what you were going to write copilot can do it X times faster because it is connected to a buffer editor.

<hr>

But *copiloting* tools already exist today, it's the lsp in editors that understand the project and highlight errors with invalid logic. I've been using rust analyzer and it's great. Variable referencing autocomplete, tools to extract variables into variables, automatic generating base implementations for traits and my favorite fill match branches. Writing assistants already exist and where copilot is using AI to guess from its batch of known answers, analyzers have solid knowledge of the code base and provide correct corrections.

Writing code that expands already exists through tools like emmet. And the obvious abstraction of logic is functions.  Many of the JS *"snippets"* that I use are a function in the Rust standard library. And where functions don't cut it Rust macros are a more flexible way to write reusable code.

### Writing less code

More code is not better. One of the demos on the copilot homepage is for getting a list of repositories off of GitHub. Creating a request to retrieve data like this is already possible through external packages which provides a API front for underlining logic. Using this package is two lines of logic: a import and a function call, where the function name describes the query being done. 

However with copilot the output is four lines and in many of these demos are more. Doing this over many implementations for functions quickly increases code size. And these insertions are fixed implementations, if GitHub changes its REST api it's broken. With a package it has a single source and is one update away.

### More imaginative ideas

With GitHubs large bank of open source projects there could have been a great opportunity to recommend external code for this implementation. I want to query some DB show me packages that provide that implementation. Want to do some matrix multiplication give me a link to a package such a numpy. GH already has access to this data. The explore page is measly compared to what this could become. It would also solve many of the publicity issues projects have. Although many packages live on GitHub 90% of traffic is through elsewhere and word of mouth.

Writing code is not the hard part. Satisfying rust lifetimes is one aspect where I spend a longer time figuring out. Copilot cannot do this, it's only a generator. It is very much a black box with little context. If I were to repeat my command would it use the existing implementation or would it recreate the same statements?

Also the biggest difficult of programming is documentation and tests. If copilot worked in reverse and could attempt to document arbitrary code it would be significantly more valuable. Testing is also a undervalued area. One can create a 20k LOC project without a single test. I think there is a area to reduce the current steep curve to creating tests. If generating code based of intent is possible it would be best used in generating unit tests for these projects.
