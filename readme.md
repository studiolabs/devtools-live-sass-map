# Sass Map

Parses Sass files in a directory and exposes a map of dependencies

## Install

Install with [npm](https://npmjs.org/package/sass-map)

```
npm install --save-dev sass-map
```

## Usage

Usage as a Node library:

```js
var sassMap = require('sass-map');
```

Usage as a command line tool:

The command line tool will parse a graph and then either display ancestors, descendents or both.

```
$ ./bin/sassmap --help
Usage: bin/sassmap <command> [options] <dir> [file]

Commands:
  ancestors    Output the ancestors
  descendents  Output the descendents

Options:
  -I, --load-path   Add directories to the sass load path
  -e, --extensions  File extensions to include in the map
  -j, --json        Output the index in json
  -h, --help        Show help
  -v, --version     Show version number

Examples:
  ./bin/sassmap descendents test/fixtures test/fixtures/a.scss
  /path/to/test/fixtures/b.scss
  /path/to/test/fixtures/_c.scss
```

## API

#### parseDir

Parses a directory and builds a dependency map of all requested file extensions.

#### parseFile

Parses a file and builds its dependency map.

## Options

#### loadPaths

Type: `Array`
Default: `[process.cwd]`

Directories to use when resolved `@import` directives.

#### extensions

Type: `Array`
Default: `['scss', 'css']`

File types to be parsed.

## Example

```js
var sassMap = require('sass-map');
console.log(sassMap.parseDir('test/fixtures'));

//{ index: {,
//    '/path/to/test/fixtures/a.scss': {
//        imports: ['b.scss']
//    },
//    '/path/to/test/fixtures/b.scss': {
//        imports: ['_c.scss']
//    },
//    '/path/to/test/fixtures/_c.scss': {
//        imports: []
//    },
//}}
```

## Running Mocha tests

You can run the tests by executing the following commands:

```
npm install
npm test
```

## Authors

[Steed Monteiro](http://twitter.com/SteedMonteiro).

## License

BSD
