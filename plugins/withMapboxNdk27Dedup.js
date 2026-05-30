// Config plugin: force a single Mapbox Maps SDK on the Android classpath.
//
// @rnmapbox/maps and @badatgil/expo-mapbox-navigation pull different Mapbox Maps
// SDK versions/variants (plain vs -ndk27), which collide as "Duplicate class
// com.mapbox.maps.*". This appends a Gradle resolutionStrategy to the root
// build.gradle that rewrites every Mapbox maps/plugin module to its -ndk27
// sibling pinned to one version, so the whole app resolves to one set of AARs.

const { withProjectBuildGradle } = require("@expo/config-plugins");

// Must be >= the version @rnmapbox/maps targets (its package.json `mapbox.android`,
// 11.20.1 for rnmapbox 10.3.1) so its Kotlin resolves all Maps SDK symbols, and
// it's a forward minor bump over what mapbox-navigation pulls (11.14.0), which is
// API-compatible within Mapbox Maps major 11.
const MAPBOX_MAPS_VERSION = "11.20.1";

const START = "// @mapbox-ndk27-dedup:start";
const END = "// @mapbox-ndk27-dedup:end";

const BLOCK = `${START} — unify Mapbox Maps SDK to the ndk27 variant @ ${MAPBOX_MAPS_VERSION} (plugins/withMapboxNdk27Dedup.js)
allprojects {
  configurations.all {
    resolutionStrategy.eachDependency { details ->
      def req = details.requested
      def isMapboxMaps = req.group == 'com.mapbox.maps' ||
                         req.group == 'com.mapbox.plugin' ||
                         (req.group == 'com.mapbox.module' && req.name.startsWith('maps-'))
      if (isMapboxMaps) {
        if (req.name.endsWith('-ndk27')) {
          details.useVersion('${MAPBOX_MAPS_VERSION}')
        } else {
          details.useTarget("\${req.group}:\${req.name}-ndk27:${MAPBOX_MAPS_VERSION}")
          details.because('Align @rnmapbox/maps with the ndk27 Mapbox SDK required by mapbox-navigation')
        }
      }
    }
  }
}
${END}`;

// Matches a previously-injected block (between the start/end markers, inclusive)
// so re-runs REPLACE it with the current version instead of leaving a stale one.
const BLOCK_RE = new RegExp(
  `${escapeRe(START)}[\\s\\S]*?${escapeRe(END)}`,
  "g",
);

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = function withMapboxNdk27Dedup(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") {
      throw new Error(
        "withMapboxNdk27Dedup: expected a groovy build.gradle (Kotlin DSL not supported).",
      );
    }
    let contents = cfg.modResults.contents.replace(BLOCK_RE, "").trimEnd();
    cfg.modResults.contents = `${contents}\n\n${BLOCK}\n`;
    return cfg;
  });
};
