// Dynamic Expo config. The base config lives in app.json (static); this file
// only injects the Mapbox SECRET downloads token (sk.) into the @rnmapbox/maps
// plugin at prebuild time, read from the environment so the secret is never
// written into a committed file.
//
// Expo loads .env into process.env before evaluating this config, so locally
// the token comes from .env (RNMAPBOX_MAPS_DOWNLOAD_TOKEN). On EAS it comes
// from the EAS Secret of the same name. The rnmapbox plugin then writes it to
// android/gradle.properties (MAPBOX_DOWNLOADS_TOKEN) and the iOS Podfile.

const RNMAPBOX = "@rnmapbox/maps";
const withMapboxNdk27Dedup = require("./plugins/withMapboxNdk27Dedup");

module.exports = ({ config }) => {
  const downloadToken = process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN;

  const plugins = (config.plugins ?? []).map((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    if (name !== RNMAPBOX) return plugin;

    const options = Array.isArray(plugin) ? (plugin[1] ?? {}) : {};
    return [
      RNMAPBOX,
      // Only set the key when we actually have a token, so a missing env var
      // doesn't overwrite anything or break prebuild — it just no-ops.
      downloadToken
        ? { ...options, RNMapboxMapsDownloadToken: downloadToken }
        : options,
    ];
  });

  // Resolve the @rnmapbox/maps vs mapbox-navigation duplicate-class conflict by
  // forcing every Mapbox Maps module to the ndk27 variant at one version.
  plugins.push(withMapboxNdk27Dedup);

  return { ...config, plugins };
};
