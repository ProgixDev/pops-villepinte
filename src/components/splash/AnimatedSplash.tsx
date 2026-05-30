import { Component, useCallback, useEffect, useRef } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";

const logoVideo = require("../../../assets/video/logo.mp4") as number;
const logoImage = require("../../../assets/images/pops-logo.png") as number;

// Brand background — matches the native expo-splash-screen color so there's no
// flash when the native splash hands off to this one.
const SPLASH_BG = "#f2b40a";
const VIDEO_START_SECONDS = 1;
// Hard ceiling: dismiss even if the video never reports playToEnd (codec
// stall, dropped event, etc). Kept short so a returning user isn't held up.
const AUTO_COMPLETE_MS = 4000;

export type AnimatedSplashProps = {
  onComplete: () => void;
};

// Static brand fallback shown if the video player can't initialise / render
// (e.g. an Android emulator with no H.264 codec). Keeps the splash from being
// a blank screen or a hard crash.
function StaticLogo(): React.ReactElement {
  return (
    <Image
      source={logoImage}
      contentFit="contain"
      cachePolicy="memory-disk"
      recyclingKey="pops-logo"
      style={{ width: 160, height: 160 }}
    />
  );
}

// Catches render-time crashes from <VideoView> and degrades to the static logo
// instead of taking the whole app down. Also nudges the splash forward so a
// failed video doesn't strand the user on the splash.
class VideoErrorBoundary extends Component<
  { onError: () => void; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  componentDidCatch(): void {
    this.props.onError();
  }
  render(): React.ReactNode {
    if (this.state.failed) return <StaticLogo />;
    return this.props.children;
  }
}

function VideoSplash({ onComplete }: AnimatedSplashProps): React.ReactElement {
  const player = useVideoPlayer(logoVideo, (p) => {
    p.muted = true;
    p.loop = false;
    p.currentTime = VIDEO_START_SECONDS;
    p.play();
  });

  useEffect(() => {
    const endSub = player.addListener("playToEnd", onComplete);
    // expo-video surfaces playback failures via statusChange → fall through to
    // dismissal rather than hanging on a frozen first frame.
    const statusSub = player.addListener("statusChange", ({ status }) => {
      if (status === "error") onComplete();
    });
    return () => {
      endSub.remove();
      statusSub.remove();
    };
  }, [player, onComplete]);

  return (
    <VideoView
      player={player}
      nativeControls={false}
      allowsPictureInPicture={false}
      contentFit="contain"
      style={{ width: 240, height: 240 }}
    />
  );
}

/**
 * Startup splash: plays the branded logo video, then hands control back to the
 * root layout via onComplete (on playToEnd, on player error, or after a hard
 * timeout — whichever comes first). Wrapped so a video failure degrades to a
 * static logo instead of crashing the app.
 */
export default function AnimatedSplash({
  onComplete,
}: AnimatedSplashProps): React.ReactElement {
  const completingRef = useRef(false);
  const finish = useCallback(() => {
    if (completingRef.current) return;
    completingRef.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const t = setTimeout(finish, AUTO_COMPLETE_MS);
    return () => clearTimeout(t);
  }, [finish]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: SPLASH_BG,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <VideoErrorBoundary onError={finish}>
        <VideoSplash onComplete={finish} />
      </VideoErrorBoundary>
    </View>
  );
}
