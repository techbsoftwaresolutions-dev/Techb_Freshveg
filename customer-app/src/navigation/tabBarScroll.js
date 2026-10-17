import { useCallback, useMemo, useRef } from "react";
import { Animated, Easing, Platform } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// The tab bar slides away while the shopper scrolls a tab screen down and
// comes back as soon as they scroll up a little, or reach the top or the end
// of the list. It never hides within TOP_ZONE of the top, and flips only after
// FLIP of travel in one direction, so finger jitter never toggles it.
const TOP_ZONE = 56;
const FLIP = 12;
const DURATION = 240;

// The floating bar's own height (RootNavigator's styles.tabBar).
export const TAB_BAR_HEIGHT = 64;

// 0 = showing, 1 = scrolled away. There is one tab bar, so one value: the bar
// and the screens' bottom bars read it, the focused screen's scroll drives it.
export const tabBarHidden = new Animated.Value(0);
let hidden = false;

function setHidden(next) {
  if (next === hidden) return;
  hidden = next;
  Animated.timing(tabBarHidden, {
    toValue: next ? 1 : 0,
    duration: DURATION,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: Platform.OS !== "web",
  }).start();
}

// The tab bar floats over the screen, so tab screens end their scroll content
// `space` lower to keep the last item clear of it. A bar pinned to the screen's
// bottom edge pads itself `space` taller (the tab bar floats on its white) and
// takes `footerLift`, which drops it into the tab bar's place while it's away.
export function useTabBarSpace() {
  const { bottom } = useSafeAreaInsets();
  const space = TAB_BAR_HEIGHT + Math.max(bottom, 10);
  const footerLift = useMemo(
    () => ({ transform: [{ translateY: tabBarHidden.interpolate({ inputRange: [0, 1], outputRange: [0, space - bottom] }) }] }),
    [space, bottom]
  );
  return { space, footerLift };
}

// Spread onto a tab screen's main ScrollView / FlatList. A screen coming into
// focus (a tab switch, back from a pushed page) starts with the bar showing.
export function useTabBarScroll() {
  const last = useRef({ y: 0, travel: 0 });

  useFocusEffect(
    useCallback(() => {
      last.current.travel = 0;
      setHidden(false);
    }, [])
  );

  const onScroll = useCallback((e) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const y = Math.max(0, contentOffset.y); // iOS bounce goes negative
    const s = last.current;
    const dy = y - s.y;
    s.y = y;
    if (!dy) return;
    s.travel = dy * s.travel > 0 ? s.travel + dy : dy;
    const atEnd = y + layoutMeasurement.height >= contentSize.height - 2;
    if (y < TOP_ZONE || atEnd || s.travel < -FLIP) setHidden(false);
    else if (s.travel > FLIP) setHidden(true);
  }, []);

  return { onScroll, scrollEventThrottle: 16 };
}
