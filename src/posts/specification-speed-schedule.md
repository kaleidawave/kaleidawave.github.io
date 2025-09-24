---
layout: post.njk
title: Specification, speed and (a) schedule
date: 2025-09-24
description: 365, 11.16 and a future 0.1.0 ?
image: /media/banners/specification-speed-schedule.png
tags:
  - posts
---

It is Ezno week! As it has been three years since the [initial announcement](/posts/introducing-ezno) I thought I would publish three blog posts that were lying around and trying to spin this project up again after taking a break this last year.

---

To recap Ezno is "A fast and correct TypeScript type checker and compiler with additional experiments".

I started this project because: I wanted to learn more Rust (and to get better at programming on large projects) and I had some interesting ideas about what a type-checker could do.

> Also because there were still Coronavirus lockdowns around that time and that was the only thing to do back then.

Three years since the announcement: it has gone from a private demo on a collection of ideas, to a small open-source project. Development currently has been *slowly* chipping away at sections of a feature, getting some base cases working, understanding the core abstractions and then experimenting with new ideas.

Although it is not ready for production, there are many achievements to *celebrate* at this *checkpoint stage*. This post outlines an overview of some progress since the announcement.

### Specification

At the announcement, there were no tests for type-checking. Testing a large and continually changing project can unrewarding and laborious. In 2023, I added [tests to the project](https://github.com/kaleidawave/ezno/pull/50) in the form of a markdown file that is *compiled* in to Rust code using the default test harness. This markdown form of tests for type-checking doubles up as readable documentation for the currently supported features as well as being a format that is really easy to add new tests to.

In the year after, working on more features the number of tests went from around 30 to around 350. 

The latest iteration of this markdown-testing idea has been in [a standalone tool called *spectra*](https://github.com/kaleidawave/experiments/pull/2). It is currently still as an experiement or a canary release but I have been using it with great success on [several](https://github.com/kaleidawave/simple-json-parser/blob/improvements/specification.md) [of](https://github.com/kaleidawave/simple-toml-parser/blob/improvements/specification.md) [my](https://github.com/kaleidawave/simple-markdown-parser/blob/improvements/tests/specification.md) [parsers](https://github.com/kaleidawave/experiments/blob/general-parser/general-parser/specification.md). 

With some recent improvements, there are now 365 tests passing on Ezno. 

The next step is a [*v2* of the specification](https://github.com/kaleidawave/ezno/pull/230) with general improvements to split the [`specification.md`](https://github.com/kaleidawave/ezno/blob/main/checker/specification/specification.md) into multiple files and [add more detailed documentation into it](https://github.com/kaleidawave/ezno/blob/specification-two/specification/02-checker/01-types/03-generics/01-inference-and-substitution.md#implementation). 

If you have suggestions for documentation, things you think would be good to include you can leave comments on [the PR](https://github.com/kaleidawave/ezno/pull/230).

### Speed

Building a performant type-checker is a hard task. To get the type systems working in the first place is a challenge on its own but to do that while considering memory usage and eliminating overhead is a whole other level.

However, it is a benefitial thing to do. For users it can reduce CI costs and buys more space for additional features.

And as an implementor it is quite an interesting, you learn about lower-level tooling and forces you to revisit previous code. 

Oftenly making code shorter and more simple rewards you with the improved performance without thinking about the details.

This has been the case with [last years parser change](https://github.com/kaleidawave/ezno/pull/191). Moving to a simpler model has brought the parsing way down. Before the change, for large files, the parsing time count was 2-3 times the type-checking time. [After the change the parsing took the same time as type-checking](https://x.com/kaleidawave/status/1846238071026487560/photo/1).

More recently (at the start of this summer), I worked on optimising the layout of structures in the parser. I built a parser for some of the diagnostics you can get out of the [Rust compiler](https://github.com/kaleidawave/experiments/pull/10). Using this tool I could easily find some places where there were enums with variants significantly larger than common constructed forms (clippy does not catch all cases). After some changes I managed to drop memory usage by over half as well as a ~20% reduction in execution time. Comparing these currently **unmerged** changes against the `main` branch, [the CI reports](https://github.com/kaleidawave/experiments/pull/10).

```shell
binaries/binary-LinuxX64-main-last/binary-LinuxX64-main-last: 10 837 025 bytes allocated and 44 930 722 instructions
binaries/latest/ezno: 4 660 067 bytes allocated and 39 699 629 instructions
```

and

```shell
Summary
  ./binaries/binary-LinuxX64-general-fixes-last/binary-LinuxX64-general-fixes-last check demo.tsx ran
  ...
  1.21 ± 0.02 times faster than ./binaries/binary-LinuxX64-main-last/binary-LinuxX64-main-last check demo.tsx
```

This is one important part the performance work: to have a open and public log of results that can calculate differences and integrates with the CI checking and so forth. 

GitHub actions is far from perfect, I have been trying to find a more precise and predictable tool to `hyperfine` (*ironically*). GitHub actions can vary in performance quite a bit and do not have access to systems that require root level access such as `perf_events`. 

Last Friday, I found out about [SDE](https://www.intel.com/content/www/us/en/developer/articles/tool/software-development-emulator.html). I am still learning about it, but effectively it does *binary instrumentation* (effectively a CPU emulator) to run a binary while counting various kinds of instructions that have been run. This is perfect as we can see exact counts of instructions **run** (not emitted) and under different sections of the program. Of course [I then built a parser to analyse the output](https://github.com/kaleidawave/experiments/pull/20) and now have it running in the GitHub CI.

I am still learning what it emits and how to act on it. But recent work on another project found Rust [does not collapse a hot path in the lexer](https://godbolt.org/z/jcYea4Mhx). On my WIP branch I managed to change some things in the lexer to take total instructions `28 354 432` instructions to `27 286 219`.

> I will do a dedicated blog post on the parser and the exacts of last years lexer change but there is still more work to do. Similiarly for "monitoring performance in CI", I still need to learn more about [SDE](https://www.intel.com/content/www/us/en/developer/articles/tool/software-development-emulator.html). Whether it can give more information on memory, why it lists 10 million less instructions run than callgrind, dealing with inlined code, instruction wall-clock time heuristics and maybe adding a 'diffing' functionality to my [sde-parsing tool](https://github.com/kaleidawave/experiments/pull/20). If you have tips/experience, leave it in the comments below!

This is on top of a the existing general principle of the project of writing minimal code, using a low numbers of dependencies, writing iterators rather than allocating vectors etc.

---

So with all these improvements, how is the performance going?

Well using the [specification.md file](https://github.com/kaleidawave/ezno/blob/main/checker/specification/specification.md) [from earlier](#specification) we can build an amalgamation of examples on the specification. We remove `import` and `export` examples as we want to compile it to a single file and we do some transformations so there are no clashes with names. The [corpus](https://en.wikipedia.org/wiki/Text_corpus) contains a breadth of features (and so tests a wide range of behaviors that could exist in a program) and now with 365 (minus module tests) we get around 2k LOC of code to test against. It doesn't accurately reflect a program, but it alright at this stage. We know running performance results on this file are accurate because the examples covers all features and does not include stuff that is incomplete or can currently crash the checker. [You can view the whole file here](https://gist.github.com/kaleidawave/81066f322ed574b3373e27770137013f).

And running in the new CI setup, we see the **latest** on the `general-fixes` branches [runs in around ~10ms](https://github.com/kaleidawave/ezno/actions/runs/17956348682). 

---

This does not mean much on its own, so we can compare it to the most complete type-checkers and here we see an impressive result when checking our 2k LOC example.

```shell
Benchmark 1: ./ezno check demo.tsx
  Time (mean ± σ):       8.3 ms ±   0.2 ms    [User: 6.3 ms, System: 1.7 ms]
  Range (min … max):     8.0 ms …   9.5 ms    316 runs
 
Benchmark 2: ./node_modules/@typescript/native-preview-linux-x64/lib/tsgo --noEmit --jsx preserve --skipLibCheck demo.tsx
  Time (mean ± σ):      92.1 ms ±   3.5 ms    [User: 119.0 ms, System: 29.3 ms]
  Range (min … max):    86.3 ms … 100.4 ms    32 runs
 
Benchmark 3: node ./node_modules/typescript/lib/_tsc.js --noEmit --jsx preserve --skipLibCheck demo.tsx
  Time (mean ± σ):     772.9 ms ±   6.3 ms    [User: 1451.6 ms, System: 63.3 ms]
  Range (min … max):   761.9 ms … 780.4 ms    10 runs
 
Summary
  ./ezno check demo.tsx ran
   11.16 ± 0.48 times faster than ./node_modules/@typescript/native-preview-linux-x64/lib/tsgo --noEmit --jsx preserve --skipLibCheck demo.tsx
   93.65 ± 2.18 times faster than node ./node_modules/typescript/lib/_tsc.js --noEmit --jsx preserve --skipLibCheck demo.tsx
```

When we concatenate the file 10 times over, we see a good but slightly less impressive result compared to TSC based compilers (for some reason they does not seem to scale linearly).

```shell
Benchmark 1: ./ezno check demo10.tsx
  Time (mean ± σ):      72.3 ms ±   1.3 ms    [User: 60.3 ms, System: 11.7 ms]
  Range (min … max):    70.3 ms …  78.7 ms    41 runs
 
Benchmark 2: ./node_modules/@typescript/native-preview-linux-x64/lib/tsgo --noEmit --jsx preserve --skipLibCheck demo10.tsx
  Time (mean ± σ):     476.2 ms ±   9.8 ms    [User: 646.7 ms, System: 69.9 ms]
  Range (min … max):   464.1 ms … 496.4 ms    10 runs
 
Benchmark 3: node ./node_modules/typescript/lib/_tsc.js --noEmit --jsx preserve --skipLibCheck demo10.tsx
  Time (mean ± σ):      1.863 s ±  0.086 s    [User: 4.296 s, System: 0.104 s]
  Range (min … max):    1.805 s …  2.082 s    10 runs
 
Summary
  ./ezno check demo10.tsx ran
    6.58 ± 0.18 times faster than ./node_modules/@typescript/native-preview-linux-x64/lib/tsgo --noEmit --jsx preserve --skipLibCheck demo10.tsx
   25.76 ± 1.27 times faster than node ./node_modules/typescript/lib/_tsc.js --noEmit --jsx preserve --skipLibCheck demo10.tsx
```

> [Full benchmark public here](https://github.com/kaleidawave/benchmarks/actions/runs/17978178009)

With `--timings` in Ezno and `--diagnostics` in TSC. We can see some a breakdown for these results

```shell
# in Ezno
Diagnostics: 4320
Types:       48667
Lines:       21990
Cache read:  205.976µs
FS read:     1.383218ms
Parsed in:   23.138385ms
Checked in:  37.645912ms
Narrowing:   327.594µs
Reporting:   639.726µs

# in tsgo
Files:               8
Lines:           61095
Identifiers:     70224
Symbols:         50955
Types:           11370
Instantiations:   4224
Memory used:    42754K
Memory allocs:  793413
Parse time:     0.059s
Bind time:      0.021s
Check time:     0.392s
Emit time:      0.000s
Total time:     0.509s
```

Again Ezno is currently work-in-progress, so these differences are not usable in code today. But you can see that currently implemented parts are going well.

[tsgo](https://github.com/microsoft/typescript-go) is great, because it builds something I did not exactly want to build that being: a *exact drop-in faster type-checker for use in the near future*. It never made any sense to try and do what is the job of the TSC team for exclusively performance reasons, which is something I have not been too bothered by when writing TypeScript code. 

Instead, I decided to build something different, new and original. Based on learning how it all works, rather than being a human transpiler. Recognising that some of TSCs code has been written a while ago, with different aims. That there are [new features that can be added in places](/posts/experimental-types/) and [existing problems can be fixed by starting from the ground up](/posts/implementing-narrowing/#explicit-type-annotation-type-guards). And that at the end of the day you can still maintain some compatability and [keep existing features](/posts/mapped-types/).

There are a few differences between the type-checkers, firstly the checking behaviour in different in Ezno compared to TSC ([with an aim to get very similar errors](https://kaleidawave.github.io/ezno/comparison/)). Ezno is written in [Rust](https://www.rust-lang.org/) whereas [tsgo](https://github.com/microsoft/typescript-go) is written in [Golang](https://go.dev/). Ezno does not doing anything in parallel currently, but [may when it is more mature](https://github.com/kaleidawave/ezno/issues/38). For `lib.d.ts` it has a compressed binary form, rather than reading a human readable file. [This drops a lot of initial overhead](/posts/ezno-23/#binary-context%2Fdefinition-files) as it does not have to deal with hoisting etc. Without `--max-diagnostics` being specified, Ezno only [prints the first 30 diagnostics](https://github.com/kaleidawave/ezno/blob/c152aed0ca13313a3b1607a04975fce4c7d638a8/src/utilities.rs#L115) whereas `tsc` prints every error.

> Rust and Golang, are very good programming languages and very good for compilers, parsers and other command line programs. I can see why the TSC team went for Golang with its inbuilt mark-and-sweep garbage collection for there syntactical port.

Building a faster type-checker is and should never be a competition. Instead, I include this comparison for *optimism*: that there are still improvements that can be made in the type-checking space and you do not need to loads of resource or experience to make a dent there! You can ignore the discussion online that should but doesn't actually mean anything and make remarkable progress on something that others deem impossible! If you have an idea for something, let this be evidence that it is possible. Go build it and share it online!

---

Alright enough flexing and pontification, when can *I* use the thing?

### *Schedule*

> Not quite the right heading, but have to stick to the 's' theme

This blog post has been a showing a trend in the right direction on the specification tests and performance numbers. This is a hobby project for me, not a job. It has been an *extracurricular*, in learning new things and building stuff that I can direct and deem new and useful. I do not set many deadlines and work mostly on things that I think will be fun to work on.

Events/partial application is the *invisible* elephant in the room for usability. I would like to do a talk before the blog post, so if you have meetup in Europe get in contact! I would like to release the blog post on some of the findings within the twelve months. While cool, the events feature is large and complex, which will be hard to scale to large and complex codebases. Before the next `0.1.0` release there will be a flag to disable some of the feature and make using external packages infinitely easier.

For the [framework idea proposed in the initial blog post](/posts/introducing-ezno/#the-"framework"), it has not really been worked on since 2022. The improvement to the underlying compiler findings has made it a lot more possible and flexible, so maybe when I find the time I will put out a demonstration of how the type-checking logic can benefit specific parts of front-end code. But it has moved out of the primary focus of the compiler.

There are three other ideas I want to work on for version `0.1.0`. All going well it could be as soon as the end of this year? The `0.1.0` release should work (aka catch 95% of type erros) in small low-dependency projects. So I will *cut* the release when I have some of my examples working at that level (and not just concatenations of test cases).

You can star and watch [the repository](https://github.com/kaleidawave/ezno) for that announcement and [sponsor](https://github.com/sponsors/kaleidawave) to help it fall this side of the new year!

For more updates you can follow this as [blog as RSS](https://kaleidawave.github.io/feed.xml) and follow me on [X](https://x.com/kaleidawave) and [BlueSky](https://bsky.app/profile/kaleidawave.bsky.social). 
