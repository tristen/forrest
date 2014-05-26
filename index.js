d3 = require('d3');
require('mapbox.js');
var geocode = require('geocode-many');
var geojson = require('geojson');
var metatable = require('d3-metatable')(d3);
var saveAs = require('filesaver.js');
var cookie = require('wookie');

var mapid, map, markers;
var fileName = 'data';
var set = d3.set([]);
var data = [];
var exportOptions = [{
    name: 'Choose',
    value: ''
}, {
    name: 'CSV',
    value: 'csv'
}, {
    name: 'GeoJSON',
    value: 'geojson'
}];

if (!cookie.get('mapid')) {
    h1('Enter a Mapbox Map ID');
    sub('A <a href="https://www.mapbox.com/foundations/glossary/#mapid">Map ID</a> is a unique identifier to a map you have created on <a href="https://mapbox.com">Mapbox.com</a>');

    var form = d3.select('.js-output')
        .append('div')
        .classed('col6 margin3 pad2y pill', true);

    form.append('input')
        .attr('type', 'text')
        .attr('placeholder', 'username.mapid')
        .classed('pad1 col8', true);

    form.append('a')
        .attr('href', '#')
        .text('submit')
        .classed('button fill-green pad1 col4', true)
        .on('click', function() {
            var val;
            d3.event.stopPropagation();
            d3.event.preventDefault();
            d3.select('input[type=text]').html(function() {
                val = this.value;
            });

            if (val.length) {
                d3.json('http://a.tiles.mapbox.com/v3/' + val + '.json', function(error, json) {
                    if (error) {
                        h1('Unknown Map ID. <a href="/forrest/">Try again?</a>.');
                    } else {
                        cookie.set('mapid', val);
                        init();
                    }
                });
            }
        });

} else {
    init();
}

function init() {
    mapid = cookie.get('mapid');
    h1('Import a comma separated file');
    sub('Could be a .csv, .tsv, or .dsv file.');

    d3.select('.js-output')
    .html('')
    .append('a')
    .attr('href', '#')
    .classed('button fill-green round pad2 col6 margin3', true)
    .text('Add')
    .on('click', function() {
        d3.event.stopPropagation();
        d3.event.preventDefault();
        event = document.createEvent('HTMLEvents');
        event.initEvent('click', true, false);
        document.getElementById('import').dispatchEvent(event);
    });

    d3.select('body')
        .append('div')
        .classed('pin-bottom tooltip tooltip-bottomright pad0x', true)
        .append('a')
        .attr('href', '#')
        .classed('sprite sprocket contain', true)
        .html('<span class="round small keyline-all pad1">Clear stored Map ID?</span>')
        .on('click', function() {
            d3.event.stopPropagation();
            d3.event.preventDefault();
            cookie.unset('mapid');
            location.reload();
        });
}

d3.select('.js-file')
    .on('change', function() {
        d3.event.stopPropagation();
        d3.event.preventDefault();
        var files = d3.event.target.files;
        if (files.length && detectType(files[0]) === 'dsv') {

            filename = files[0].name.split('.');
            fileName = filename.slice(0, filename.length - 1).join('.');

            readFile(files[0], function(err, res) {
                if (err) return h1(message);
                data = d3.csv.parse(res);
                var displayData = [];
                for (var k in data[0]) {
                    displayData.push({ label: k, val: data[0][k] });
                }
                h1('Choose fields');
                sub('Select the columns that contain address information you want to geocode');
                var output = d3.select('.js-output');
                    output.html('');
                    output.selectAll('div')
                    .data(displayData)
                    .enter()
                    .append('div')
                    .classed('pad0 col4', true)
                    .html(function(d) {
                        return '<input type="checkbox" id="' + cleanStr(d.label) + '" value="' + d.label + '">' +
                        '<label class="keyline-all pad1 round" for="' + cleanStr(d.label) + '">' + d.label +
                        '<em class="block small normal quiet">' + d.val + '</em></label>';
                    })
                    .selectAll('input')
                    .on('change', function() {
                        (set.has(this.value)) ?
                            set.remove(this.value) :
                            set.add(this.value);
                    });

                output.append('div')
                    .classed('pad2y col12 clearfix', true)
                    .append('a')
                    .classed('button fill-green col6 margin3 pad2 round', true)
                    .text('Geocode')
                    .attr('href', '#')
                    .on('click', function() {
                        d3.event.stopPropagation();
                        d3.event.preventDefault();

                        if (set.values().length) {
                            var queries = [];
                            data.forEach(function(d) {
                                var query = [];
                                for (var k in d) if (set.has(k)) query.push(d[k]);
                                queries.push({
                                    name: query.join(', ')
                                });
                            });

                            h1('Geocoding ...');
                            sub('');
                            output.html('');

                            var p = d3.select('.js-output')
                                .append('div')
                                .classed('progress round-top fill-darken pad0 contain', true);

                                p.append('div')
                                    .classed('fill fill-blue pin-left', true);

                            displayData.push({
                                    label: 'Latitude'
                                }, {
                                    label: 'Longitude'
                                });

                            // Map and table views
                            var views = d3.select('.js-output')
                                .append('div')
                                .classed('clip views', true);

                            var table = views
                                .append('table')
                                .classed('prose active col12 table', true);

                            table.append('thead')
                                .append('tr')
                                .selectAll('th')
                                .data(displayData)
                                .enter()
                                .append('th')
                                .text(function(d) {
                                    return d.label;
                                });

                            table.append('tbody');
                            var geocoder = geocode(mapid, 0);
                            geocoder(queries, transform, progress, done);

                            views
                                .append('div')
                                .attr('id', 'map')
                                .classed('map row10 col12', true);

                            // Initialize a map here.
                            map = L.mapbox.map('map', mapid);
                            markers = L.mapbox.featureLayer().addTo(map);
                        }
                    });
            });
        } else {
            h1('Unsupported format. <a href="/forrest/">Try again?</a>.');
        }
    });

function progress(e) {
    var row = data[e.done - 1];
    var results = (e.data) ? e.data.results : undefined;

    if (results && results.length && results[0].length) {
        row.latitude = results[0][0].lat;
        row.longitude = results[0][0].lon;
        row.type = results[0][0].type;
    }

    d3.select('table')
        .select('tbody')
        .append('tr')
        .classed(e.status, true)
        .selectAll('td')
        .data(d3.values(row))
        .enter()
        .append('td')
        .text(function(td) {
            return td;
        });

    var ratio = 100 / e.todo;
    var percent = parseInt((e.done * ratio), 10);
    d3.select('.fill').style('width', percent + '%');
}

function transform(obj) {
    return obj.name;
}

function done(err, res) {
    d3.select('table')
        .classed('editable', true)
        .html('')
        .data([data])
        .call(metatable({
            newCol: false,
            deleteCol: false,
            renameCol: false
        }).on('change', function(d, i) {
            data[i] = d;
        }));

    if (err.length) {
        h1('There was a problem geocoding! <a href="/">Try again?</a>.');
        sub('');
    }

    h1('Geocoding complete!');
    sub('Choose an export method');

    d3.select('.progress')
        .classed('done', true);

    var exportOps = d3.select('.js-output')
        .insert('div', '.progress')
        .classed('col12 clearfix contain z10', true);

    var options = exportOps.append('select')
        .classed('margin3 col6', true)
        .on('change', function() {
            if (this.value) {
                var exportName = (this.value === 'csv') ? fileName + '-geocoded' : fileName;
                saveAs(new Blob([exportData(this.value)], {
                    type: 'text/plain;charset=utf-8'
                }), exportName + '.' + this.value);
            }
        });

    options.selectAll('option')
        .data(exportOptions)
        .enter()
        .append('option')
        .text(function(d) { return d.name; })
        .attr('value', function(d) { return d.value; });

    // Toggle controls to view table/map.
    var toggle = exportOps.append('div')
        .classed('js-toggle toggle col2 margin5 pad1y inline center', true)
        .selectAll('a')
        .data(['Table', 'Map'])
        .enter()
        .append('a')
        .attr('class', function(t) {
            var names = 'keyline-all pad1x pad0y col6 small';
            if (t === 'Table') names += ' active';
            return names;
        })
        .attr('href', '#')
        .text(function(t) { return t; })
        .on('click', function() {
            d3.event.stopPropagation();
            d3.event.preventDefault();

            // Active toggling of the switch
            d3.selectAll('.toggle a').classed('active', false);
            d3.select(this).classed('active', true);

            // Active toggling of the containers
            var view = this.innerText.toLowerCase();
            d3.select('.views .active').classed('active', false);
            d3.select('.' + view).classed('active', true);

            if (view === 'map') {
                map.invalidateSize();
                geojson.parse(data, {Point: ['latitude', 'longitude']}, function(gj) {
                    markers.setGeoJSON(gj);
                    markers.eachLayer(function(m) {
                        var props = m.feature.properties;
                        var content = '<nav>';
                        for (var key in props) {
                            content += '<div><strong>' + key + '</strong>: ' + props[key] + '</div>';
                        }
                        content += '</nav>';
                        m.bindPopup(content);
                    });
                    map.fitBounds(markers.getBounds());
                });
            }
        });
}

function exportData(method) {
    var v;
    if (method === 'geojson') {
        geojson.parse(data, {Point: ['latitude', 'longitude']}, function(gj) {
            v =  JSON.stringify(gj);
        });
    } else if (method === 'csv') {
        v =  d3.csv.format(data);
    }
    return v;
}

function h1(title) { d3.select('.js-heading').html(title); }
function sub(subtext) { d3.select('.js-sub').html(subtext); }

function readFile(f, cb) {
    try {
        var reader = new FileReader();
        reader.readAsText(f);
        reader.onload = function(e) {
            (e.target && e.target.result) ?
                cb(null, e.target.result) :
                cb(readError(f));
        };
        reader.onerror = readError(f);
    } catch(e) {
        cb(readError(f));
    }
}

function cleanStr(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-*$/, '');
}

function readError(f) {
    return {
        message: 'Could not read file. <a href="/">Try again?</a>.'
    };
}

function detectType(f) {
    var filename = f.name ? f.name.toLowerCase() : '';
    function ext(_) { return filename.indexOf(_) !== -1; }
    if (f.type === 'text/csv' ||
        ext('.csv') ||
        ext('.tsv') ||
        ext('.dsv')) {
        return 'dsv';
    }
}
