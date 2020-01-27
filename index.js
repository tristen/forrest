require('mapbox.js');
const d3 = require('d3');
const geocode = require('geocode-many');
const geojson = require('geojson');
const metatable = require('d3-metatable');
const saveAs = require('file-saver');
let token, map, markers;
const fileName = 'data';
const set = d3.set([]);
const data = [];
const exportOptions = [{
  name: 'Choose',
  value: ''
}, {
  name: 'CSV',
  value: 'csv'
}, {
  name: 'GeoJSON',
  value: 'geojson'
}];

if (!localStorage.getItem('token')) {
  h1('Enter your Access Token');
  sub('Don\'t have an <a target="_blank" href="https://www.mapbox.com/help/create-api-access-token/">Access token?</a>');

  const form = d3.select('.js-output')
    .append('div')
    .attr('class', 'col4 margin4 pad2y pill');

  form.append('input')
    .attr('type', 'text')
    .attr('placeholder', 'AccessToken')
    .attr('class', 'pad1 col8');

  form.append('a')
    .attr('href', '#')
    .text('submit')
    .attr('class', 'button fill-green pad1 col3')
    .on('click', () => {
      let val;
      d3.event.stopPropagation();
      d3.event.preventDefault();
      d3.select('input[type=text]').html(function() {
        val = this.value;
      });

      if (val.length) {
        d3.json('http://api.tiles.mapbox.com/v4/geocode/mapbox.places/toronto.json?access_token=' + val, (error, json) => {
          if (error) {
            h1('Unknown token. <a href="/forrest/">Try again?</a>.');
          } else {
            localStorage.setItem('token', val);
            init();
          }
        });
      }
    });

} else {
  init();
}

function init() {
  token = localStorage.getItem('token');
  h1('Import a comma separated file');
  sub('Could be a .csv, .tsv, or .dsv file.');

  d3.select('.js-output')
    .html('')
    .append('a')
    .attr('href', '#')
    .attr('class', 'button fill-green round pad2 col4 margin4')
    .text('Add')
    .on('click', () => {
      d3.event.stopPropagation();
      d3.event.preventDefault();
      event = document.createEvent('HTMLEvents');
      event.initEvent('click', true, false);
      document.getElementById('import').dispatchEvent(event);
    });

  d3.select('header').select('nav')
    .append('span')
    .attr('class', 'sprite icon sprocket contain round tooltip')
    .append('a')
    .attr('class', 'round small pad1')
    .text('Clear stored Map ID?')
    .on('click', () => {
      d3.event.stopPropagation();
      d3.event.preventDefault();
      localStorage.removeItem('token');
      location.reload();
    });
}

d3.select('.js-file')
  .on('change', () => {
    d3.event.stopPropagation();
    d3.event.preventDefault();
    const files = d3.event.target.files;
    if (files.length && detectType(files[0]) === 'dsv') {

      filename = files[0].name.split('.');
      fileName = filename.slice(0, filename.length - 1).join('.');

      readFile(files[0], (err, res) => {
        if (err) return h1(message);
        data = d3.csv.parse(res);
        const displayData = [];
        for (let k in data[0]) {
          displayData.push({
            label: k,
            val: data[0][k]
          });
        }
        h1('Choose fields');
        sub('<strong>Only</strong> select the columns that contain address information you want to geocode.');
        const output = d3.select('.js-output');
        output.html('');
        output.selectAll('div')
          .data(displayData)
          .enter()
          .append('div')
          .attr('class', () => {
            const num = 3;
            const cols = displayData.length;
            if (cols === 3) num = 4;
            if (cols === 2) num = 6;
            if (cols === 1) num = 12;
            return 'pad0 col' + num;
          })
          .html(d => {
            return '<input type="checkbox" id="' + cleanStr(d.label) + '" value="' + d.label + '">' +
              '<label class="keyline-all pad1 round truncate" for="' + cleanStr(d.label) + '">' + d.label +
              '<span class="block small normal quiet truncate">' + d.val + '</em></span>';
          })
          .selectAll('input')
          .on('change', e => {
            const {
              value
            } = e.target;
            (set.has(value)) ?
            set.remove(value):
              set.add(value);
          });

        output.append('div')
          .attr('class', 'pad2y col12 clearfix')
          .append('a')
          .attr('class', 'button fill-green col4 margin4 pad2 round')
          .text('Geocode')
          .attr('href', '#')
          .on('click', () => {
            d3.event.stopPropagation();
            d3.event.preventDefault();

            if (set.values().length) {
              const queries = [];
              data.forEach((d) => {
                const query = [];
                for (let k in d)
                  if (set.has(k)) query.push(d[k]);
                queries.push({
                  name: query.join(', ')
                });
              });

              h1('Geocoding ...');
              sub('');
              output.html('');

              const p = d3.select('.js-output')
                .append('div')
                .attr('class', 'progress round-top fill-darken pad0 contain');

              p.append('div')
                .attr('class', 'fill fill-blue pin-left');

              displayData.push({
                label: 'Latitude'
              }, {
                label: 'Longitude'
              });

              // Map and table views
              const views = d3.select('.js-output')
                .append('div')
                .attr('class', 'clip views');

              const table = views
                .append('table')
                .attr('class', 'prose active col12 table');

              table.append('thead')
                .append('tr')
                .selectAll('th')
                .data(displayData)
                .enter()
                .append('th')
                .text(d => {
                  return d.label;
                });

              table.append('tbody');
              const geocoder = geocode(token, 0);
              geocoder(queries, transform, progress, done);

              views
                .append('div')
                .attr('id', 'map')
                .attr('class', 'map row10 col12');

              // Initialize a map here.
              L.mapbox.accessToken = localStorage.getItem('token');
              map = L.mapbox.map('map', 'tristen.map-4s93c8qx');
            }
          });
      });
    } else {
      h1('Unsupported format. <a href="/forrest/">Try again?</a>.');
    }
  });

function progress(e) {
  const row = data[e.done - 1];
  const results = (e.data) ? e.data.features : undefined;
  if (results && results.length) {
    row.latitude = results[0].center[1];
    row.longitude = results[0].center[0];
    row.type = results[0].type;
  } else {
    row.latitude = row.longitude = 0;
    row.type = '';
  }

  d3.select('table')
    .select('tbody')
    .append('tr')
    .selectAll('td')
    .data(d3.values(row))
    .enter()
    .append('td')
    .text(td => {
      return td;
    });

  const ratio = 100 / e.todo;
  const percent = parseInt((e.done * ratio), 10);
  d3.select('.fill').style('width', percent + '%');
}

function transform(obj) {
  return obj.name;
}

function editTable() {
  return metatable({
    newCol: false,
    deleteCol: false,
    renameCol: false
  }).on('change', (d, i) => {
    data[i] = d;
  });
}

function done(err, res) {
  d3.select('table').remove();
  d3.select('.views')
    .insert('div')
    .attr('class', 'editable prose active col12 table keyline-all')
    .data([data])
    .call(editTable());

  if (err.length) {
    h1('There was a problem geocoding! <a href="/">Try again?</a>.');
    sub('');
  }

  h1('Geocoding complete!');
  sub('Choose an export method');

  d3.select('.progress')
    .classed('done', true);

  const exportOps = d3.select('.js-output')
    .insert('div', '.progress')
    .attr('class', 'col12 clearfix contain z10');

  const options = exportOps.append('select')
    .attr('class', 'margin4 col4')
    .on('change', e => {
      const {
        value
      } = e.target;
      if (value) {
        const exportName = (value === 'csv') ? fileName + '-geocoded' : fileName;
        saveAs(new Blob([exportData(value)], {
          type: 'text/plain;charset=utf-8'
        }), exportName + '.' + value);
      }
    });

  options.selectAll('option')
    .data(exportOptions)
    .enter()
    .append('option')
    .text(d => d.name)
    .attr('value', d => d.value);

  // Toggle controls to view table/map.
  const toggle = exportOps.append('div')
    .attr('class', 'js-toggle toggle col2 margin5 pad1y inline center')
    .selectAll('a')
    .data(['Table', 'Map'])
    .enter()
    .append('a')
    .attr('class', t => {
      const names = 'keyline-all pad1x pad0y col6 small';
      if (t === 'Table') names += ' active';
      return names;
    })
    .attr('href', '#')
    .text(t => t)
    .on('click', () => {
      d3.event.stopPropagation();
      d3.event.preventDefault();

      // Active toggling of the switch
      d3.selectAll('.toggle a').classed('active', false);
      d3.select(this).classed('active', true);

      // Active toggling of the containers
      const view = this.innerText.toLowerCase();
      d3.select('.views .active').classed('active', false);
      d3.select('.' + view).classed('active', true);

      if (view === 'map') {
        map.invalidateSize();
        geojson.parse(data, {
          Point: ['latitude', 'longitude']
        }, gj => {

          // Remove Previous
          if (markers) map.removeLayer(markers);
          markers = new L.FeatureGroup();

          for (let i = 0; i < gj.features.length; i++) {
            let m = gj.features[i];
            const c = (m.geometry.coordinates) ?
              m.geometry.coordinates : [0, 0];

            const p = m.properties;
            const marker = L.marker([c[1], c[0]], {
                icon: L.mapbox.marker.icon({
                  'marker-color': '#f86767',
                }),
                draggable: true
              })
              .on('dragend', e => {
                const newCoords = this.getLatLng();
                const d = data[this.indexInData];
                d.latitude = newCoords.lat;
                d.longitude = newCoords.lng;
                d3.select('.table').data([data]).call(editTable());
              })
              .addTo(map);

            marker.indexInData = i;
            marker.bindPopup(content(p));
            markers.addLayer(marker);
          }

          function content(props) {
            const html = '<nav>';
            for (let key in props) {
              html += '<div><strong>' + key + '</strong>: ' + props[key] + '</div>';
            }
            html += '</nav>';
            return html;
          }

          map.addLayer(markers).fitBounds(markers.getBounds());
        });
      }
    });
}

function exportData(method) {
  let v;
  if (method === 'geojson') {
    geojson.parse(data, {
      Point: ['latitude', 'longitude']
    }, gj => {

      // Iterate over the set and make sure there is
      // at least a geometry.coordinates value.
      for (let i = 0; i < gj.features.length; i++) {
        const feature = gj.features[i];
        if (!feature.geometry.coordinates) {
          feature.geometry.coordinates = [0, 0];
        }
      }

      v = JSON.stringify(gj);
    });
  } else if (method === 'csv') {
    v = d3.csv.format(data);
  }
  return v;
}

function h1(title) {
  d3.select('.js-heading').html(title);
}

function sub(subtext) {
  d3.select('.js-sub').html(subtext);
}

function readFile(f, cb) {
  try {
    const reader = new FileReader();
    reader.readAsText(f);
    reader.onload = e => {
      (e.target && e.target.result) ?
      cb(null, e.target.result):
        cb(readError(f));
    };
    reader.onerror = readError(f);
  } catch (e) {
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
  const filename = f.name ? f.name.toLowerCase() : '';

  function ext(_) {
    return filename.indexOf(_) !== -1;
  }
  if (f.type === 'text/csv' ||
    ext('.csv') ||
    ext('.tsv') ||
    ext('.dsv')) {
    return 'dsv';
  }
}
