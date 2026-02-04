---
layout: post.njk
title: A JSON parser in less than 250 lines-of-code
description: On JSON and how to build a parser for it
date: 2026-01-28
editDate: 2026-01-04
image: /media/banners/parsing-json.png
tags: posts
---

Over the winter break I spent some time working on [my JSON parser](https://github.com/kaleidawave/simple-json-parser) I wrote in late 2023. I had seen that with additions I made over the year, it had become a little bloated and had gone above an initially recorded statistic for line-of-code.

With some simplification to the existing logic I managed to get it to around 250 lines-of-code of Rust counted from the `fn` keyword to the last `}` brace of the main parsing function.

This is a quick post outlining some of the tricks and choices made when building this JSON parser.

> The library is open-source and on [crates.io](https://crates.io/crates/simple-json-parser) but the latest code is under [this PR](https://github.com/kaleidawave/simple-json-parser/pull/6) and yet to merge at the time of writing.

With such a short implementation, I can paste it in its full glory and explain it later!

> Some definitions elided, [full code here](https://github.com/kaleidawave/simple-json-parser/blob/47f7c3304020ebac8de8ca897d4b5fc6ee95f828/lib.rs)

```rust
pub fn parse_with_options<'a, T>(
    on: &'a str,
    options: &ParseOptions,
    mut cb: impl for<'b> FnMut(&'b [JSONKey<'a>], RootJSONValue<'a>) -> Option<T>,
) -> Result<(usize, Option<T>), JSONParseError> {
    fn find_non_escaped_quoted(on: &str) -> Option<usize> {
        on.match_indices('"').find_map(|(idx, _)| {
            let rev = on[..idx].bytes();
            let last = rev.rev().take_while(|chr: &u8| *chr == b'\\').count();
            (last % 2 == 0).then_some(idx)
        })
    }

    fn parse_comment(on: &str) -> Option<(&str, usize)> {
        if let Some(rest) = on.strip_prefix('#') {
            let offset = rest.find('\n').unwrap_or(rest.len());
            Some((&on[..offset], offset + 1))
        } else if let Some(rest) = on.strip_prefix("//") {
            let offset = rest.find('\n').unwrap_or(rest.len());
            Some((&on[..offset], offset + 2))
        } else if let Some(rest) = on.strip_prefix("/*") {
            let offset = rest.find("*/")?;
            Some((&rest[..offset], offset + 4))
        } else {
            None
        }
    }

    let (mut idx, mut key_chain, mut in_object): (usize, Vec<JSONKey<'_>>, bool) =
        Default::default();
    let (bytes, tls) = (on.as_bytes(), options.top_level_separator);

    if tls.is_some() {
        key_chain.push(JSONKey::Index(0));
    }

    macro_rules! emit {
        ($item:expr) => {
            // TODO pass idx
            let res = cb(&key_chain, $item);
            if res.is_some() {
                return Ok((idx, res));
            }
        };
    }

    macro_rules! return_err {
        ($reason:ident) => {
            return Err(JSONParseError {
                at: idx,
                reason: JSONParseErrorReason::$reason,
            });
        };
    }

    macro_rules! skip_whitespace_find_comments {
        () => {
            while let Some(byte) = bytes.get(idx) {
                if let b' ' | b'\t' | b'\r' | b'\n' = byte {
                    idx += 1;
                } else if let b'/' | b'#' = byte {
                    let Some((comment, offset)) = parse_comment(&on[idx..]) else {
                        return_err!(InvalidComment);
                    };
                    idx += offset;
                    if options.yield_comments {
                        emit!(RootJSONValue::Comment(comment));
                    }
                } else {
                    break;
                }
            }
        };
    }

    skip_whitespace_find_comments!();

    while idx < bytes.len() {
        if in_object {
            skip_whitespace_find_comments!();
            if let Some(b'"') = bytes.get(idx) {
                let rest = &on[1..][idx..];
                let Some(offset) = find_non_escaped_quoted(rest) else {
                    return_err!(ExpectedQuote);
                };
                key_chain.push(JSONKey::Slice(&rest[..offset]));
                idx += offset + 2;
                skip_whitespace_find_comments!();
                if on.as_bytes().get(idx).copied().unwrap_or_default() != b':' {
                    // TODO partial could find next ':'?
                    return_err!(ExpectedColon);
                }
                idx += 1;
            } else {
                return_err!(ExpectedKey);
            }
        }

        skip_whitespace_find_comments!();

        match bytes.get(idx).copied() {
            Some(b'{') => {
                idx += 1;
                // little hack
                skip_whitespace_find_comments!();
                if let Some(b'}') = bytes.get(idx) {
                    idx += 1;
                    emit!(RootJSONValue::EmptyObject);
                } else {
                    in_object = true;
                    continue;
                }
            }
            Some(b'[') => {
                idx += 1;
                key_chain.push(JSONKey::Index(0));
                in_object = false;
                continue;
            }
            Some(b']') => {
                idx += 1;
                match key_chain.pop() {
                    Some(JSONKey::Index(0)) => {
                        emit!(RootJSONValue::EmptyArray);
                    }
                    Some(JSONKey::Index(_)) if options.allow_trailing_commas => {}
                    _ => {
                        return_err!(ExpectedEndOfValue);
                    }
                }
                in_object = matches!(key_chain.last(), Some(JSONKey::Slice(_)));
            }
            Some(b'"') => {
                let rest = &on[idx..][1..];
                let Some(offset) = find_non_escaped_quoted(rest) else {
                    return_err!(ExpectedEndOfValue);
                };
                idx += offset + 2;
                emit!(RootJSONValue::String(JSONString(&rest[..offset])));
            }
            Some(b'0'..=b'9' | b'-') => {
                /// can include bad values
                fn find_non_number(chr: char) -> bool {
                    !matches!(chr, '0'..='9' | '.' | 'e' | 'E' | '+' | '-')
                }

                let rest = &on[idx..];
                let Some(offset) = rest.find(find_non_number) else {
                    return_err!(ExpectedEndOfValue);
                };
                idx += offset;
                emit!(RootJSONValue::Number(JSONNumber(&rest[..offset])));
            }
            Some(b't') if on[idx..].starts_with("true") => {
                idx += 4;
                emit!(RootJSONValue::Boolean(true));
            }
            Some(b'f') if on[idx..].starts_with("false") => {
                idx += 5;
                emit!(RootJSONValue::Boolean(false));
            }
            Some(b'n') if on[idx..].starts_with("null") => {
                idx += 4;
                emit!(RootJSONValue::Null);
            }
            Some(b @ (b',' | b'}')) if options.partial_syntax => {
                emit!(RootJSONValue::Empty);
                idx += 1;
                if in_object {
                    let _ = key_chain.pop();
                }
                if b == b',' {
                    continue;
                }
            }
            _ => {
                return_err!(ExpectedValue);
            }
        }

        while let Some(byte) = bytes.get(idx) {
            if key_chain.is_empty() {
                return Ok((idx, None));
            }

            if tls.is_some_and(|c: char| on[idx..].starts_with(c)) {
                idx += 1;
                if let [JSONKey::Index(ref mut idx)] = key_chain.as_mut_slice() {
                    *idx += 1;
                    break;
                }
            } else if let b' ' | b'\t' | b'\r' | b'\n' = byte {
                idx += 1;
            } else if let b'/' | b'#' = byte {
                let Some((comment, offset)) = parse_comment(&on[idx..]) else {
                    return_err!(InvalidComment);
                };
                idx += offset;
                if options.yield_comments {
                    emit!(RootJSONValue::Comment(comment));
                }
            } else {
                let new_byte = if *byte == b',' {
                    idx += 1;
                    if let Some(JSONKey::Index(ref mut idx)) = key_chain.last_mut() {
                        *idx += 1;
                    } else {
                        key_chain.pop();
                    }
                    if !options.allow_trailing_commas {
                        break;
                    }
                    skip_whitespace_find_comments!();
                    let Some(b @ (b'}' | b']')) = bytes.get(idx) else {
                        break;
                    };
                    *b
                } else {
                    *byte
                };
                match new_byte {
                    b'}' if *byte == b',' || in_object => {}
                    b']' if matches!(key_chain.last(), Some(JSONKey::Index(_))) => {}
                    _ => {
                        return_err!(ExpectedEndOfValue);
                    }
                }
                idx += 1;
                key_chain.pop();
                in_object = matches!(key_chain.last(), Some(JSONKey::Slice(_)));
            }
        }
    }

    let tl = tls.is_some_and(|_| matches!(key_chain.as_slice(), &[JSONKey::Index(_)]));

    if !(key_chain.is_empty() || tl) {
        return_err!(ExpectedBracket);
    }

    Ok((on.len(), None))
}
```

---

Some basics of the architecture

- Callback function based (explained later)
- No string copy (values have data based on points into the input buffer)
- [No dependencies](https://crates.io/crates/simple-json-parser/0.0.5/dependencies)

It supports many features

- [New line delimited JSON](https://github.com/kaleidawave/simple-json-parser/blob/improvements/specification.md#new-line-separated)
- [Trailing commas](https://github.com/kaleidawave/simple-json-parser/blob/improvements/specification.md#trailing-commas-1)
- [Comments (of many varieties)](https://github.com/kaleidawave/simple-json-parser/blob/improvements/specification.md#comments)
- [Returning at the end of a value (object, etc.)](https://github.com/kaleidawave/simple-json-parser/blob/improvements/specification.md#extra-characters)
- [Early return when a value has been found](https://github.com/kaleidawave/simple-json-parser/blob/improvements/specification.md#early-return)
- [Partial source, which is useful when the source is still being worked on](https://github.com/kaleidawave/simple-json-parser/blob/improvements/specification.md#partial-syntax)

These are all described in the [specification](https://github.com/kaleidawave/simple-json-parser/blob/improvements/specification.md) and are tested with [spectra](https://github.com/kaleidawave/spectra) (a tool which allows checking pairwise code blocks representing an input and an output match the process of a program).

### Usage

The foundations are defining a *stack* for the keys `key_chain`, when we find a value we run the call the `cb` with a reference to the `key_chain` and an enum variant instance with the value. For example, for finding values under the path `["message"]["message"]` or `["message"]["level"]` we can use pattern matching in the callback function.

```rust
use simple_json_parser::{
    JSONKey, RootJSONValue, parse_with_options as parse_json,
};

let _ = parse_json::<()>(&out, &Default::default(), |keys, value| {
	if let [
		JSONKey::Slice("message"),
		JSONKey::Slice(kind @ ("message" | "level")),
	] = keys
	{
		if let RootJSONValue::String(value) = value {
			println!("{kind}: {value}");
		}
	}
	None
});
```

This approaches avoids the need for a `HashMap` and allocating entries for values if we do not use them in the program.

### Where JSON crops up

JSON comes up in written form as

- `package.json`

And in *data* form

- GitHub API
- Cargo output
- (spectra, depict)

### Delimited JSON

The parser *supports* new-line-delimited JSON.

Unfortunately, this is not as simple as running the parser on each item of [`std::io::Lines`](https://doc.rust-lang.org/stable/std/io/struct.Lines.html) because new-line-delimited JSON can be across multiple lines.

```json
{ 
        "x": 2
}
{ 
        "y": 3, 
        "y2": 5 
}
{ 
        "z": 4
}
```

### Building parsers

I am building a number of parsers at the moment, my goals with them are

- Configurable: support as much syntax as possible. Use options at runtime to enable *additional features*
- Lightweight
- Low line of code count

### Gotchas of the approach

The callback is needed (over a for-loop) because the `Iterator` trait is not designed to yield elements that based on the mutable lifetime given in `Iterator::next`. We could make it `Iterator` iterator but it would have to yield the owned `Vec<JSONKey<'_>>`, which would have allocate on each value (rather than use a single allocation). This is a limitation of the trait not *for-loops*. We could define a new trait `IteratorWithLifetime` which would have `find` but not `collect` etc. but still would not be usable in classic *for-loops*.

### Gotchas of parsing JSON

This key-chain contextual parser has to also account for the fact that empty array values `[]` and empty object `{}` values have some meaning. Thus, we have `emit!(RootJSONValue::EmptyObject);`.

The parser currently uses a few macros, while normally I do not use them, because of control flow with the early returning it seemed acceptable to use them here. Maybe one day we can have [reverse `?` operations](https://github.com/kaleidawave/experiments/pull/35).

The parser has cut some small parts of correctness corners for the sake of remaining lightweight.

It does not check numbers. Again if you are [trying to get a value from a JSON source](https://github.com/kaleidawave/release-downloader/blob/improvements/release-downloader/lib.rs) as fast as possible, then there is little need to 1. Check the sequence of characters is valid 2. Parse it into a floating-point number.

```rust
fn find_non_number(chr: char) -> bool {
    !matches!(chr, '0'..='9' | '.' | 'e' | 'E' | '+' | '-')
}

let rest = &on[idx..];
let Some(offset) = rest.find(find_non_number) else {
    return_err!(ExpectedEndOfValue);
};
idx += offset;
emit!(RootJSONValue::Number(JSONNumber(&rest[..offset])));
```

Instead, we delegate parsing until usage time using the [`value_unwrap`](https://github.com/kaleidawave/simple-json-parser/blob/47f7c3304020ebac8de8ca897d4b5fc6ee95f828/lib.rs#L55) method on `JSONNumber`. We have [the same for `JSONString`](https://github.com/kaleidawave/simple-json-parser/blob/47f7c3304020ebac8de8ca897d4b5fc6ee95f828/lib.rs#L25) for the required `unescape_string_content` transform.

The parser also does not check for control characters in strings. I am not sure why this restriction is in the JSON specification? Maybe for a reason unrelated to JSON.

### More on performance

A pivotal function used in JSON parsing is finding the end of a string. A simple method to achieve this would be

```rust
fn find_non_escaped_quoted(on: &str) -> Option<usize> {
	on.find('"')
}
```

Unfortunately, the method for including double quotes in strings is not `\q`, but instead `\"`. This means we have to check whether the last character was escaped. A naïve approach that accounts for this would be the following

```rust
fn find_non_escaped_quoted(on: &str) -> Option<usize> {
	let mut characters = on.bytes().enumerate();
	while let Some((idx, chr)) = characters.next() {
		if b'\\' == chr {
			let _ = characters.next();
		} else if b'"' == chr {
			return Some(idx);
		}
	}
	None
}
```

But examining for the fact that `a\\"`, `a\\\\"` and `a\\\\\\"` are all ends of a string but `a\"`, `a\\\"` and `a\\\\\"` are not we can instead write the function as

```rust
fn find_non_escaped_quoted(on: &str) -> Option<usize> {
	on.match_indices('"').find_map(|(idx, _)| {
		let rev = on[..idx].bytes();
		let last = rev.rev().take_while(|chr: &u8| *chr == b'\\').count();
		(last % 2 == 0).then_some(idx)
	})
}
```

This `find_non_escaped_quoted` function seems to be the bottleneck of the parsing implementation (when compared to other parts such as whitespace skipping etc.). Using [depict](https://github.com/kaleidawave/depict) we can compare the number of instructions run for each approach.

In first (with respect to the least instructions run) is the incorrect but future we would have had `\q` if un-escaped to `"` function.

|symbol name|count|
|---|---|
|total|55834|
|`simple_json_parser::parse_with_options`|21173|
|`<core::str::pattern::CharSearcher as core::str::pattern::Searcher>::next_match`|9184|
|`simple_json_parser::parse_with_options::find_non_escaped_quoted`|3584|
|`parse::main`|142|
|`<std::env::Args as core::iter::traits::iterator::Iterator>::next`|78|
|`main`|7|

The even check approach comes in second

|symbol name|count|
|---|---|
|total|61142|
|`simple_json_parser::parse_with_options`|21173|
|`<core::str::pattern::CharSearcher as core::str::pattern::Searcher>::next_match`|9184|
|`simple_json_parser::parse_with_options::find_non_escaped_quoted`|8940|
|`parse::main`|141|
|`<std::env::Args as core::iter::traits::iterator::Iterator>::next`|78|
|`main`|7|

With the naïve approach having executed six and half more **AArch64** operations to find the end of the strings in my `5955` byte JSON example

| symbol name                                                        | count |
| ------------------------------------------------------------------ | ----- |
| total                                                              | 84201 |
| `simple_json_parser::parse_with_options::find_non_escaped_quoted`  | 58528 |
| `simple_json_parser::parse_with_options`                           | 21188 |
| `parse::main`                                                      | 146   |
| `<std::env::Args as core::iter::traits::iterator::Iterator>::next` | 78    |
| `main`                                                             | 8     |

#### Comparing with a full JavaScript parser (Ezno)

As JSON is a subset of JavaScript objects, we can run the parser on the source. Here we see that the JSON uses 10x less instructions (`55834` vs `664 254`) that the full JavaScript parser (so ideally works out as 10x faster). 

Obviously the JavaScript parser is doing more: actually parsing bytes in strings, allocating the parsed in vectors as an abstract syntax tree, storing source positions etc. But it is interesting to see the difference in a lightweight non-recursive parser vs a full JavaScript parser.

| symbol name                                                                                                                                       | count  | mem_read | mem_write | stack_read | stack_write | call |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- | --------- | ---------- | ----------- | ---- |
| `Total`                                                                                                                                           | 664254 | 75258    | 0         | 0          | 0           | 6466 |
| `ezno_parser::strings::parse_string`                                                                                                              | 108472 | 9552     | 0         | 0          | 0           | 225  |
| `ezno_parser::lexer::Lexer::skip`                                                                                                                 | 56382  | 20022    | 0         | 0          | 0           | 0    |
| `<ezno_parser::expressions::object_literal::ObjectLiteralMember as ezno_parser::ASTNode>::from_reader`                                            | 32428  | 8174     | 0         | 0          | 0           | 1072 |
| `ezno_parser::lexer::Lexer::skip_including_comments`                                                                                              | 27404  | 6851     | 0         | 0          | 0           | 0    |
| `ezno_parser::expressions::Expression::from_reader_after_first_expression`                                                                        | 16863  | 3773     | 0         | 0          | 0           | 140  |
| `<ezno_parser::expressions::object_literal::ObjectLiteral as ezno_parser::ASTNode>::from_reader`                                                  | 10727  | 4284     | 0         | 0          | 0           | 443  |
| `ezno_parser::lexer::Lexer::is_immediate_keyword_advance`                                                                                         | 9837   | 2526     | 0         | 0          | 0           | 309  |
| `ezno_parser::expressions::Expression::from_reader_with_precedence`                                                                               | 9486   | 0        | 0         | 0          | 0           | 556  |
| `ezno_parser::functions::MethodHeader::from_reader`                                                                                               | 9380   | 1742     | 0         | 0          | 0           | 1072 |
| `<ezno_parser::property_key::PropertyKey<U> as ezno_parser::ASTNode>::from_reader`                                                                | 8910   | 2160     | 0         | 0          | 0           | 540  |
| `<ezno_parser::comments::WithComment<T> as ezno_parser::ASTNode>::from_reader`                                                                    | 8335   | 30       | 0         | 0          | 0           | 2    |
| `core::slice::memchr::memchr_aligned`                                                                                                             | 8234   | 754      | 0         | 0          | 0           | 0    |
| `ezno_parser::lexer::Lexer::parse_string_literal`                                                                                                 | 6525   | 0        | 0         | 0          | 0           | 225  |
| `ezno_parser::lexer::Lexer::expect`                                                                                                               | 6380   | 1450     | 0         | 0          | 0           | 145  |
| `<alloc::borrow::Cow<str> as core::ops::arith::AddAssign<&str>>::add_assign`                                                                      | 5850   | 1575     | 0         | 0          | 0           | 0    |
| `ezno_parser::lexer::Lexer::is_immediate_keyword`                                                                                                 | 4414   | 1104     | 0         | 0          | 0           | 158  |
| `core::ptr::drop_in_place<ezno_parser::expressions::Expression>`                                                                                  | 4296   | 1040     | 0         | 0          | 0           | 140  |
| `ezno_parser::lexer::Lexer::is_keyword_advance`                                                                                                   | 4154   | 938      | 0         | 0          | 0           | 268  |
| `ezno_parser::lexer::Lexer::is_operator_advance`                                                                                                  | 3908   | 809      | 0         | 0          | 0           | 269  |
| `core::ptr::drop_in_place< ezno_parser::expressions::object_literal::ObjectLiteralMember >`                                                       | 2948   | 670      | 0         | 0          | 0           | 0    |
| `core::str::converts::from_utf8`                                                                                                                  | 2791   | 393      | 0         | 0          | 0           | 0    |
| `<T as alloc::slice::<impl [T]>::to_vec_in::ConvertVec>::to_vec`                                                                                  | 2592   | 360      | 0         | 0          | 0           | 266  |
| `core::ptr::drop_in_place< ezno_parser::comments::WithComment<ezno_parser::property_key::PropertyKey< ezno_parser::property_key::AlwaysPublic>>>` | 2412   | 670      | 0         | 0          | 0           | 0    |
| `__rustc::__rdl_alloc`                                                                                                                            | 1785   | 0        | 0         | 0          | 0           | 0    |
| `ezno_parser::numbers::parse_no_specifier`                                                                                                        | 1551   | 246      | 0         | 0          | 0           | 12   |
| `<ezno_parser::expressions::Expression as get_field_by_type::GetFieldByType<source_map::span::BaseSpan<()>>>::get`                                | 1072   | 268      | 0         | 0          | 0           | 0    |
| `ezno_parser::lexer::Lexer::starts_with_function_header`                                                                                          | 1040   | 52       | 0         | 0          | 0           | 130  |

> This sort of side project work is not only useful for utilities, but simplifying the problem has recently helped to make Ezno faster through realising better ways to write it with prefix match style pattern and paying attention to where `skip` calls are made. (more details in the future).

### Future

There is still some more things that could be improved in the future. SIMD may be useful in some places. The `cb` could yield a mutable reference to `idx` that could be used to skip over objects (with something of the form `find_next_open_brace`). Once that and a few more things are consolidated then [the PR](https://github.com/kaleidawave/simple-json-parser/pull/6) can be merged and these updates can be available to the crate on `crates.io`.

Any suggestions or feedback is welcome in the comments below!
