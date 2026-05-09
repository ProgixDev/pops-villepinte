import { useState } from "react";
import { Text, TextInput, View, type KeyboardTypeOptions } from "react-native";

import { colors, font } from "@/constants/theme";

export type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  error?: string;
  helper?: string;
  keyboardType?: KeyboardTypeOptions;
  autoComplete?: string;
  maxLength?: number;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
};

export default function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  helper,
  keyboardType = "default",
  autoComplete,
  maxLength,
  autoCapitalize,
}: TextFieldProps): React.ReactElement {
  const [focused, setFocused] = useState(false);

  const hasError = error !== undefined && error.length > 0;
  const showHelper = !hasError && helper !== undefined && helper.length > 0;

  const borderColor = hasError
    ? colors.error
    : focused
      ? "rgba(183,16,42,0.25)"
      : "transparent";
  const borderWidth = hasError || focused ? 1.5 : 0;

  return (
    <View>
      <Text
        style={{
          fontFamily: font.bodyBold,
          fontSize: 10,
          letterSpacing: 2,
          marginBottom: 8,
          color: colors.inkMuted,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>

      <View
        style={{
          backgroundColor: "#F5F5F5",
          borderRadius: 12,
          paddingHorizontal: 20,
          paddingVertical: 18,
          borderColor,
          borderWidth,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.inkMuted}
          keyboardType={keyboardType}
          autoComplete={autoComplete as TextInput["props"]["autoComplete"]}
          maxLength={maxLength}
          autoCapitalize={autoCapitalize}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            fontFamily: font.body,
            fontSize: 16,
            color: colors.ink,
            paddingVertical: 0,
          }}
        />
      </View>

      {hasError ? (
        <Text
          style={{
            fontFamily: font.bodySemi,
            fontSize: 11,
            marginTop: 6,
            color: colors.error,
          }}
        >
          {error}
        </Text>
      ) : showHelper ? (
        <Text
          style={{
            fontFamily: font.body,
            fontSize: 11,
            lineHeight: 16,
            marginTop: 6,
            color: colors.inkMuted,
          }}
        >
          {helper}
        </Text>
      ) : null}
    </View>
  );
}
