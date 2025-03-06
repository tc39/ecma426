# Source Map Specification

This repository contains the latest draft of the ECMA-426 specification ("Source map format"), as
well as older revisions of the format developed prior to moving to Ecma.

## What's here

* [Draft Source](spec.emu)
* [Rendered Draft](https://tc39.es/ecma426/)

The current specification is an evolution of the original third revision. The
first and second revision of the spec are provided for historical context, and
don't have widespread adoption in tools.

* [Revision 3](source-map-rev3.md)
* [Revision 2](source-map-rev2.md)
* [Revision 1](source-map-rev1.md)

## Generating the draft specification

1. Run `npm ci && npm run build` from this repository's root folder
2. Open `./out/index.html` in your browser

## Current Proposals

| Proposal                                                                                   | Author                  | Stage   |
| ------------------------------------------------------------------------------------------ | ----------------------- | ------- |
| [Scopes](https://github.com/tc39/ecma426/blob/main/proposals/scopes.md)                 | Holger Benl, Simon Zünd | Stage 3 |
| [Range Mappings](https://github.com/tc39/ecma426/blob/main/proposals/range-mappings.md) | Tobias Koppers          | Stage 2 |
| [Debug ID](https://github.com/tc39/ecma426/blob/main/proposals/debug-id.md)             | Luca Forstner           | Stage 2 |
| [Env](https://github.com/tc39/ecma426/blob/main/proposals/env.md)                       | Nick Fitzgerald         | Stage 1 |

## License

See [LICENSE.md](./LICENSE.md) for details.

## Original Locations

These documents have previously been hosted on Google Docs:

* Revision 1: [Source Mapping](https://docs.google.com/document/d/1g6tuP7unEkxUSZwLm4IcLoJn1eNDhEmZLAV2kphdvOY/edit)
* Revision 2: [Closure Compiler Source Map 2.0](https://docs.google.com/document/d/1xi12LrcqjqIHTtZzrzZKmQ3lbTv9mKrN076UB-j3UZQ/edit?hl=en_US)
* Revision 3: [Source Map Revision 3 Proposal](https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit#heading=h.1ce2c87bpj24)
