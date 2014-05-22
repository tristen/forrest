d3 = require('d3');
var geocode = require('geocode-many');
var geojson = require('geojson');
var metatable = require('d3-metatable')(d3);
var saveAs = require('filesaver.js');

// TODO user enters theirs
var mapid = 'tristen.map-4s93c8qx';
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

d3.select('.js-import')
    .on('click', function() {
        d3.event.stopPropagation();
        d3.event.preventDefault();
        event = document.createEvent('HTMLEvents');
        event.initEvent('click', true, false);
        document.getElementById('import').dispatchEvent(event);
    });

d3.select('.js-file')
    .on('change', function() {
        d3.event.stopPropagation();
        d3.event.preventDefault();
        var files = d3.event.target.files;
        if (files.length && detectType(files[0]) === 'dsv') {
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
                        '<label class="truncate keyline-all pad1 round" for="' + cleanStr(d.label) + '">' + d.label +
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

                        d3.select('.js-output')
                            .append('div')
                            .classed('clip table keyline-all', true);

                        var table = d3.select('.table')
                            .append('table')
                            .classed('prose', true);

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
                    });
            });
        } else {
            h1('Unsupported format. <a href="/">Try again?</a>.');
        }
    });

function progress(e) {
    var row = data[e.done - 1];
    var results = (e.data) ? e.data.results : undefined;

    if (results && results.length && results[0].length) {
        row.latitude = results[0][0].lat;
        row.longitude = results[0][0].lon;
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
        .html('')
        .data([data])
        .call(metatable({
            newCol: false,
            deleteCol: false,
            renameCol: false
        }));

    if (err.length) {
        h1('There was a problem geocoding! <a href="/">Try again?</a>.');
        sub('');
    }

    h1('Geocoding complete!');
    sub('Choose an export method');

    d3.select('.progress')
        .classed('done', true);

    d3.select('.js-output')
        .insert('div', '.progress')
        .classed('col12 space-bottom2 clearfix export contain z10', true);

    var options = d3.select('.export').append('select')
        .classed('margin3 col6', true)
        .on('change', function() {
            if (this.value) {
                saveAs(new Blob([exportData(this.value)], {
                    type: 'text/plain;charset=utf-8'
                }), 'data.' + this.value);
            }
        });

    options.selectAll('option')
        .data(exportOptions)
        .enter()
        .append('option')
        .text(function(d) { return d.name; })
        .attr('value', function(d) { return d.value; });
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
