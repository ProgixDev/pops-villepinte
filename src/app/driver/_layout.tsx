import { Stack } from "expo-router";

export default function DriverLayout(): React.ReactNode {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="assignment/[id]" options={{ presentation: "modal" }} />
      <Stack.Screen name="delivery/[id]" />
      <Stack.Screen name="navigate/[id]" />
    </Stack>
  );
}
