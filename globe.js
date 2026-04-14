(function () {
    "use strict";

   const WORLD_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
    const US_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";
    const CSV_URL = "visited_places.csv";

   const WIDTH = 500;
    const HEIGHT = 500;
    const VISITED_COLOR = "#0075B0";
    const VISITED_US_COLOR = "#0075B0";
    const DEFAULT_COLOR = "#e0e0e0";
    const DEFAULT_US_COLOR = "#d5d5d5";
    const OCEAN_COLOR = "#f7fbff";
    const BORDER_COLOR = "#fff";
    const HOVER_COLOR = "#f4a300";

   /* ---- state name -> FIPS id mapping ---- */
   const stateFIPS = {
         "AL": "01", "AK": "02", "AZ": "04", "AR": "05", "CA": "06",
         "CO": "08", "CT": "09", "DE": "10", "FL": "12", "GA": "13",
         "HI": "15", "ID": "16", "IL": "17", "IN": "18", "IA": "19",
         "KS": "20", "KY": "21", "LA": "22", "ME": "23", "MD": "24",
         "MA": "25", "MI": "26", "MN": "27", "MS": "28", "MO": "29",
         "MT": "30", "NE": "31", "NV": "32", "NH": "33", "NJ": "34",
         "NM": "35", "NY": "36", "NC": "37", "ND": "38", "OH": "39",
         "OK": "40", "OR": "41", "PA": "42", "RI": "44", "SC": "45",
         "SD": "46", "TN": "47", "TX": "48", "UT": "49", "VT": "50",
         "VA": "51", "WA": "53", "WV": "54", "WI": "55", "WY": "56",
         "DC": "11"
   };

   /* ---- parse CSV ---- */
   function parseCSV(text) {
         const lines = text.trim().split("\n");
         const headers = lines[0].split(",");
         return lines.slice(1).map(function (line) {
                 const vals = line.split(",");
                 const obj = {};
                 headers.forEach(function (h, i) { obj[h.trim()] = vals[i] ? vals[i].trim() : ""; });
                 return obj;
         });
   }

   /* ---- main ---- */
   function initGlobe() {
         var container = d3.select("#globe-container");
         if (container.empty()) return;

      var svg = container.append("svg")
           .attr("viewBox", "0 0 " + WIDTH + " " + HEIGHT)
           .style("max-width", WIDTH + "px")
           .style("width", "100%")
           .style("height", "auto")
           .style("display", "block")
           .style("margin", "0 auto")
           .style("cursor", "grab");

      var projection = d3.geoOrthographic()
           .scale(WIDTH / 2.2)
           .translate([WIDTH / 2, HEIGHT / 2])
           .clipAngle(90)
           .rotate([-10, -30]);

      var path = d3.geoPath().projection(projection);

      /* ocean */
      svg.append("circle")
           .attr("cx", WIDTH / 2).attr("cy", HEIGHT / 2)
           .attr("r", projection.scale())
           .attr("fill", OCEAN_COLOR)
           .attr("stroke", "#ccc");

      var gCountries = svg.append("g");
         var gUS = svg.append("g");
         var gBorders = svg.append("g");

      /* tooltip */
      var tooltip = container.append("div")
           .style("position", "absolute")
           .style("pointer-events", "none")
           .style("background", "rgba(0,0,0,0.75)")
           .style("color", "#fff")
           .style("padding", "4px 10px")
           .style("border-radius", "4px")
           .style("font-size", "13px")
           .style("white-space", "nowrap")
           .style("display", "none");

      /* drag to rotate */
      var startRotate, startPos;
         var drag = d3.drag()
           .on("start", function (event) {
                     startRotate = projection.rotate();
                     startPos = [event.x, event.y];
                     svg.style("cursor", "grabbing");
           })
           .on("drag", function (event) {
                     var dx = event.x - startPos[0];
                     var dy = event.y - startPos[1];
                     var sensitivity = 0.4;
                     projection.rotate([
                                 startRotate[0] + dx * sensitivity,
                                 Math.max(-90, Math.min(90, startRotate[1] - dy * sensitivity))
                               ]);
                     render();
           })
           .on("end", function () {
                     svg.style("cursor", "grab");
           });
         svg.call(drag);

      /* zoom */
      var zoom = d3.zoom()
           .scaleExtent([0.5, 5])
           .on("zoom", function (event) {
                     var s = WIDTH / 2.2 * event.transform.k;
                     projection.scale(s);
                     svg.select("circle").attr("r", s);
                     render();
           });
         svg.call(zoom);

      /* data holders */
      var visitedCountryCodes = new Set();
         var visitedStateFIPS = new Set();
         var worldData, usData, countryNames = {};

      /* render function */
      function render() {
              if (worldData) {
                        gCountries.selectAll("path").attr("d", path);
              }
              if (usData) {
                        gUS.selectAll("path").attr("d", path);
              }
              gBorders.selectAll("path").attr("d", path);
      }

      /* load all data */
      Promise.all([
              d3.json(WORLD_URL),
              d3.json(US_URL),
              fetch(CSV_URL).then(function (r) { return r.text(); })
            ]).then(function (results) {
              var worldTopo = results[0];
              var usTopo = results[1];
              var csvText = results[2];

                          /* parse visited places */
                          var places = parseCSV(csvText);
              places.forEach(function (p) {
                        if (p.type === "country") {
                                    p.code = String(Number(p.code)); visitedCountryCodes.add(p.code);
                        } else if (p.type === "state") {
                                    var abbr = p.code.replace("US-", "");
                                    if (stateFIPS[abbr]) visitedStateFIPS.add(stateFIPS[abbr]);
                        }
              });

                          /* world countries */
                          worldData = topojson.feature(worldTopo, worldTopo.objects.countries);

                          /* build name lookup from CSV */
                          places.forEach(function (p) {
                                    if (p.type === "country") countryNames[p.code] = p.name;
                          });

                          var countries = gCountries.selectAll("path")
                .data(worldData.features.filter(function (d) {
                            return d.id !== "840" && d.properties.name !== "United States of America";
                }))
                .enter().append("path")
                .attr("d", path)
                .attr("fill", function (d) {
                            return visitedCountryCodes.has(String(d.id)) ? VISITED_COLOR : DEFAULT_COLOR;
                })
                .attr("stroke", BORDER_COLOR)
                .attr("stroke-width", 0.4)
                .on("mouseover", function (event, d) {
                            var name = countryNames[String(d.id)] || d.properties.name || "ID:" + d.id;
                            var visited = visitedCountryCodes.has(String(d.id));
                            d3.select(this).attr("fill", HOVER_COLOR);
                            tooltip.style("display", "block").text(name + (visited ? " ✓" : ""));
                })
                .on("mousemove", function (event) {
                            var rect = container.node().getBoundingClientRect();
                            tooltip
                              .style("left", (event.clientX - rect.left + 12) + "px")
                              .style("top", (event.clientY - rect.top - 28) + "px");
                })
                .on("mouseout", function (event, d) {
                            d3.select(this).attr("fill",
                                                             visitedCountryCodes.has(String(d.id)) ? VISITED_COLOR : DEFAULT_COLOR);
                            tooltip.style("display", "none");
                });

                          /* US states */
                          usData = topojson.feature(usTopo, usTopo.objects.states);

                          gUS.selectAll("path")
                .data(usData.features)
                .enter().append("path")
                .attr("d", path)
                .attr("fill", function (d) {
                            return visitedStateFIPS.has(d.id) ? VISITED_US_COLOR : DEFAULT_US_COLOR;
                })
                .attr("stroke", BORDER_COLOR)
                .attr("stroke-width", 0.3)
                .on("mouseover", function (event, d) {
                            var name = d.properties.name || "State";
                            var visited = visitedStateFIPS.has(d.id);
                            d3.select(this).attr("fill", HOVER_COLOR);
                            tooltip.style("display", "block").text(name + (visited ? " ✓" : ""));
                })
                .on("mousemove", function (event) {
                            var rect = container.node().getBoundingClientRect();
                            tooltip
                              .style("left", (event.clientX - rect.left + 12) + "px")
                              .style("top", (event.clientY - rect.top - 28) + "px");
                })
                .on("mouseout", function (event, d) {
                            d3.select(this).attr("fill",
                                                             visitedStateFIPS.has(d.id) ? VISITED_US_COLOR : DEFAULT_US_COLOR);
                            tooltip.style("display", "none");
                });

                          /* country borders */
                          gBorders.append("path")
                .datum(topojson.mesh(worldTopo, worldTopo.objects.countries, function (a, b) { return a !== b; }))
                .attr("d", path)
                .attr("fill", "none")
                .attr("stroke", BORDER_COLOR)
                .attr("stroke-width", 0.5);

                          /* legend */
                          var legend = container.append("div")
                .style("text-align", "center")
                .style("margin-top", "8px")
                .style("font-size", "13px");
              legend.append("span")
                .style("display", "inline-block")
                .style("width", "14px").style("height", "14px")
                .style("background", VISITED_COLOR)
                .style("border-radius", "2px")
                .style("vertical-align", "middle")
                .style("margin-right", "4px");
              legend.append("span").text("Visited").style("vertical-align", "middle").style("margin-right", "16px");
              legend.append("span")
                .style("display", "inline-block")
                .style("width", "14px").style("height", "14px")
                .style("background", DEFAULT_COLOR)
                .style("border-radius", "2px")
                .style("vertical-align", "middle")
                .style("margin-right", "4px");
              legend.append("span").text("Not visited").style("vertical-align", "middle");

                          render();
      }).catch(function (err) {
              console.error("Globe load error:", err);
              container.append("p").text("Failed to load globe data.").style("color", "red");
      });
   }

   /* wait for DOM */
   if (document.readyState === "loading") {
         document.addEventListener("DOMContentLoaded", initGlobe);
   } else {
         initGlobe();
   }
})();
