'use strict';

var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var glob = require('glob');

function parseData(content) {
  //strip comment
  content = new String(content).replace(/\/\*.+?\*\/|\/\/.*(?=[\n\r])/g, '');

  var mixin = [];
  var imports = [];
  var property = [];
  var extend = [];
  var extensions = [];
  // find sass var;
  var position = 0;

  var regVar = /^\$([a-zA-Z0-9-\.]+):/;
  var regMix = /^\@mixin ([a-zA-Z0-9-\.]+)( ?)([(|{])/;
  var regExtend = /^\@extend ( ?)%([a-zA-Z0-9-\.]+)( ?);/;
  var regImport = /\@import [\'|\"]([a-zA-Z0-9-\._\/]+)[\'|\"]/;

  content.split('\n').forEach(function(line) {
    line = line.trim();
    if (position == 0) {
      var matchVar = regVar.exec(line);
      var matchMix = regMix.exec(line);

      if (matchVar) {
        var variable = matchVar[1].trim();
        property.push('$' + variable);
      }

      if (matchMix) {
        var mix = matchMix[1].trim();
        property.push(mix + '(');
      }
    } else {

      var matchExtend = regExtend.exec(line);
      if (matchExtend) {
        var mix = matchExtend[2].trim();
        extensions.push('%' + mix);
      }
    }

    var matchImport = regImport.exec(line);

    if (matchImport) {
        var importFile = matchImport[1].trim();
        imports.push(importFile);
      }

    var openFunction = line.match(/\{/g) || [];
    var closeFunction = line.match(/\}/g) || [];
    position += openFunction.length;
    position -= closeFunction.length;

  });

  var varUsed = content.match(/\$([a-zA-Z0-9-\.]+)/g) || [];
  var mixUsed = content.match(/([a-zA-Z0-9-\.]+)\(/g) || [];
  var extendUsed = content.match(/\%([a-zA-Z0-9-\.]+)( ?)([{])/g) || [];

  if (extendUsed.length > 0) {
    var regExtend = /\%([a-zA-Z0-9-\.]+)( ?)([{])/;
    extendUsed.forEach(function(line, index) {
      var matchExtend = regExtend.exec(line);
      if (matchExtend) {
        extend.push('%' + matchExtend[1]);
      }
    });
  }

  var data = varUsed.concat(mixUsed);

  return {
    data: _.uniq(data),
    imports: _.uniq(imports),
    extend: _.uniq(extend),
    extensions: _.uniq(extensions),
    property: _.uniq(property)
  };
}


// resolve a sass module to a path

function resolveSassPath(sassPath, loadPaths, extensions) {
  // trim sass file extensions
  var re = new RegExp('(\.(' + extensions.join('|') + '))$', 'i');
  var sassPathName = sassPath.replace(re, '');
  // check all load paths
  var i, j, length = loadPaths.length,
    scssPath, partialPath;
  for (i = 0; i < length; i++) {
    for (j = 0; j < extensions.length; j++) {
      scssPath = path.normalize(loadPaths[i] + '/' + sassPathName + '.' + extensions[j]);
      if (fs.existsSync(scssPath)) {
        return scssPath;
      }
    }

    // special case for _partials
    for (j = 0; j < extensions.length; j++) {
      scssPath = path.normalize(loadPaths[i] + '/' + sassPathName + '.' + extensions[j]);
      partialPath = path.join(path.dirname(scssPath), '_' + path.basename(scssPath));
      if (fs.existsSync(partialPath)) {
        return partialPath;
      }
    }
  }

  // File to import not found or unreadable so we assume this is a custom import
  return false;
}

function SassMap(options, dir) {
  this.dir = dir;
  this.loadPaths = options.loadPaths || [];
  this.extensions = options.extensions || [];
  this.index = [];
  this.link = [];

  if (dir) {
    var map = this;
    _(glob.sync(dir + '/**/*.@(' + this.extensions.join('|') + ')', {
      dot: true
    })).forEach(function(file) {
      map.addFile(path.resolve(file));
    }).value();
  }
};

SassMap.prototype.getIncludedLink = function (filepath) {

      var importsLinks = [];

      var file = this.index[filepath];

      importsLinks = importsLinks.concat(file.links);

      for (var i in file.imports) {
        var link = file.imports[i];
       // console.log(link);
        importsLinks = importsLinks.concat(this.getIncludedLink(link));
      }

      return importsLinks;
}

SassMap.prototype.inheritsLinks = function (filepath) {

      var file = this.index[filepath];

      return _.uniq(this.getIncludedLink(filepath));

    };


SassMap.prototype.resolveLink = function () {

    // format link
    for (var property in this.link) {
      this.link[property] = _.uniq(this.link[property]);
    }

    for (var filepath in this.index) {

      this.index[filepath].links = [];
      var links = this.index[filepath].data.map(function(property){
          return this.link[property]? this.link[property]: [];
      }.bind(this));

      if(links.length>0){
       this.index[filepath].links = _.uniq(links.reduce(function(a, b) {
          if(a && b)
            return a.concat(b);
        }));
     }

    }

    for (var filepath in this.index) {
      this.index[filepath].include = this.inheritsLinks(filepath);
    }


  };


SassMap.prototype.registerLink = function (filepath,properties){
  _.each(properties, function(property){
    if(this.link[property] === undefined){
      this.link[property] = [];
    }
    this.link[property].push(filepath);
  }.bind(this));
};

// add a sass file to the SassMap
SassMap.prototype.addFile = function(filepath, parent) {
  var entry = parseData(fs.readFileSync(filepath, 'utf-8'));
  var cwd = path.dirname(filepath);

  var i, length = entry.imports.length,
    loadPaths, resolved;
  for (i = 0; i < length; i++) {
    loadPaths = _([cwd, this.dir]).concat(this.loadPaths).filter().uniq().value();
    resolved = resolveSassPath(entry.imports[i], loadPaths, this.extensions);
    if (!resolved) continue;


    // recurse into dependencies if not already enumerated
    if (!_.contains(entry.imports, resolved)) {
      entry.imports[i]= resolved;
      this.addFile(fs.realpathSync(resolved), filepath);
    }

  }

  this.registerLink(filepath,entry.property);

  this.index[filepath] = entry;

};

// visits all files that are ancestors of the provided file
SassMap.prototype.visitAncestors = function(filepath, callback) {
  this.visit(filepath, callback, function(err, node) {
    if (err || !node) return [];
    return node.importedBy;
  });
};

// visits all files that are descendents of the provided file
SassMap.prototype.visitDescendents = function(filepath, callback) {
  this.visit(filepath, callback, function(err, node) {
    if (err || !node) return [];
    return node.imports;
  });
};

// a generic visitor that uses an edgeCallback to find the edges to traverse for a node
SassMap.prototype.visit = function(filepath, callback, edgeCallback, visited) {
  filepath = fs.realpathSync(filepath);
  var visited = visited || [];
  if (!this.index.hasOwnProperty(filepath)) {
    edgeCallback('SassMap doesn\'t contain ' + filepath, null);
  }
  var edges = edgeCallback(null, this.index[filepath]);

  var i, length = edges.length;
  for (i = 0; i < length; i++) {
    if (!_.contains(visited, edges[i])) {
      visited.push(edges[i]);
      callback(edges[i], this.index[edges[i]]);
      this.visit(edges[i], callback, edgeCallback, visited);
    }
  }
};

function processOptions(options) {
  return _.assign({
    loadPaths: [process.cwd()],
    extensions: ['scss', 'css'],
  }, options);
}

module.exports.parseFile = function(filepath, options) {
  if (fs.lstatSync(filepath).isFile()) {
    filepath = path.resolve(filepath);
    options = processOptions(options);
    var map = new SassMap(options);
    map.addFile(filepath);
    map.resolveLink();
    return map;
  }
  // throws
};



module.exports.parseDir = function(dirpath, options) {
  if (fs.lstatSync(dirpath).isDirectory()) {
    dirpath = path.resolve(dirpath);
    options = processOptions(options);
    var map = SassMap(options, dirpath);
    return map;
  }
  // throws
};
