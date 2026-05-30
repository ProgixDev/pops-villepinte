import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { colors } from "@/constants/theme";

// Drag-to-pick map rendered with Mapbox GL JS *inside a WebView*. This sidesteps
// the native rnmapbox Fabric view entirely (which deadlocks/crashes on Android
// when mounted during the screen transition). The map lives in the WebView's
// browser engine; we bridge a tiny message protocol so the surrounding React
// Native screen keeps its fixed centre pin, search bar, recenter button and
// bottom card exactly as before.
//
// Bridge:
//   WebView → RN : { type: 'ready' } | { type: 'move', lng, lat } | { type: 'idle', lng, lat }
//   RN → WebView : window.__fly(lng, lat, zoom) | window.__setUser(lng, lat)

export type WebMapHandle = {
  /** Animate the map centre to a coordinate. */
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  /** Drop / move the "you are here" dot. */
  setUserLocation: (lat: number, lng: number) => void;
};

type WebMapPickerProps = {
  initialCenter: { lat: number; lng: number };
  initialZoom?: number;
  /** Fires once the GL map has finished its first load. */
  onReady?: () => void;
  /** Fires continuously while the map is panning (centre coordinate). */
  onMove?: (lat: number, lng: number) => void;
  /** Fires when the map settles after a pan (centre coordinate). */
  onIdle?: (lat: number, lng: number) => void;
  style?: object;
};

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN ?? "";
const MAPBOX_GL_VERSION = "v3.9.0";

function buildHtml(center: { lat: number; lng: number }, zoom: number): string {
  // Coordinates are interpolated as plain numbers (never user text), so there's
  // no injection surface here.
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link href="https://api.mapbox.com/mapbox-gl-js/${MAPBOX_GL_VERSION}/mapbox-gl.css" rel="stylesheet" />
<script src="https://api.mapbox.com/mapbox-gl-js/${MAPBOX_GL_VERSION}/mapbox-gl.js"></script>
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: ${colors.ink}; }
  .user-dot {
    width: 18px; height: 18px; border-radius: 9px;
    background: #1a73e8; border: 3px solid #ffffff;
    box-shadow: 0 0 0 6px rgba(26,115,232,0.18);
  }
</style>
</head>
<body>
<div id="map"></div>
<script>
  function post(obj) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(obj));
    }
  }
  try {
    mapboxgl.accessToken = ${JSON.stringify(TOKEN)};
    var map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [${center.lng}, ${center.lat}],
      zoom: ${zoom},
      attributionControl: false,
      logoPosition: 'bottom-left'
    });
    map.on('load', function () { post({ type: 'ready' }); });

    // Throttle move events to one per animation frame so we don't flood the
    // bridge while the user drags.
    var raf = null;
    map.on('move', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = null;
        var c = map.getCenter();
        post({ type: 'move', lng: c.lng, lat: c.lat });
      });
    });
    map.on('moveend', function () {
      var c = map.getCenter();
      post({ type: 'idle', lng: c.lng, lat: c.lat });
    });

    window.__fly = function (lng, lat, zoom) {
      map.flyTo({ center: [lng, lat], zoom: zoom || 16, duration: 500 });
    };
    var userMarker = null;
    window.__setUser = function (lng, lat) {
      if (!userMarker) {
        var el = document.createElement('div');
        el.className = 'user-dot';
        userMarker = new mapboxgl.Marker({ element: el });
      }
      userMarker.setLngLat([lng, lat]).addTo(map);
    };
  } catch (e) {
    post({ type: 'error', message: String(e) });
  }
</script>
</body>
</html>`;
}

const WebMapPicker = forwardRef<WebMapHandle, WebMapPickerProps>(
  function WebMapPicker(
    { initialCenter, initialZoom = 15, onReady, onMove, onIdle, style },
    ref,
  ) {
    const webRef = useRef<WebView>(null);

    // Build the HTML once — the initial centre is baked in, and later moves go
    // through the imperative bridge (so we never reload the WebView).
    const html = useMemo(
      () => buildHtml(initialCenter, initialZoom),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
    );

    useImperativeHandle(
      ref,
      () => ({
        flyTo: (lat, lng, zoom = 16) => {
          webRef.current?.injectJavaScript(
            `window.__fly && window.__fly(${lng}, ${lat}, ${zoom}); true;`,
          );
        },
        setUserLocation: (lat, lng) => {
          webRef.current?.injectJavaScript(
            `window.__setUser && window.__setUser(${lng}, ${lat}); true;`,
          );
        },
      }),
      [],
    );

    const handleMessage = useCallback(
      (e: WebViewMessageEvent) => {
        try {
          const msg = JSON.parse(e.nativeEvent.data) as {
            type: string;
            lat?: number;
            lng?: number;
          };
          if (msg.type === "ready") {
            onReady?.();
          } else if (
            msg.type === "move" &&
            typeof msg.lat === "number" &&
            typeof msg.lng === "number"
          ) {
            onMove?.(msg.lat, msg.lng);
          } else if (
            msg.type === "idle" &&
            typeof msg.lat === "number" &&
            typeof msg.lng === "number"
          ) {
            onIdle?.(msg.lat, msg.lng);
          }
        } catch {
          // ignore malformed payloads
        }
      },
      [onReady, onMove, onIdle],
    );

    return (
      <WebView
        ref={webRef}
        source={{ html }}
        originWhitelist={["*"]}
        onMessage={handleMessage}
        // The map handles all touch; the WebView itself must not scroll/bounce.
        scrollEnabled={false}
        overScrollMode="never"
        bounces={false}
        javaScriptEnabled
        domStorageEnabled
        // Transparent-ish loading background matching the picker.
        style={[{ flex: 1, backgroundColor: colors.ink }, style]}
        // Android: keep the GL canvas on the hardware layer for smooth panning.
        androidLayerType="hardware"
      />
    );
  },
);

export default WebMapPicker;
