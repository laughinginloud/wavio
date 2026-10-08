import { type ReactNode, useCallback, useEffect, useId, useRef } from "react";
import { View } from "react-native";
import type { LayoutChangeEvent } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { Uniwind } from "uniwind";
import FadeOutScaleDown from "@/components/FadeOutScaleDown";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { cn } from "@/utils/tailwind";

// A highlighted row holds its backdrop long enough to be noticed after the
// scroll settles, then fades it out so the screen returns to its normal look.
const HIGHLIGHT_HOLD_MS = 1200;
const HIGHLIGHT_FADE_MS = 600;
// The backdrop bleeds past the row's text so it reads as a band, not a box
// hugging the labels.
const HIGHLIGHT_BACKDROP = {
  position: "absolute",
  left: -12,
  right: -12,
  top: 4,
  bottom: 4,
  borderRadius: 12,
} as const;

export function SettingsSectionTitle({
  title,
  onLayout,
}: {
  title: string;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  return (
    <Heading className="text-white mt-4" size="lg" onLayout={onLayout}>
      {title}
    </Heading>
  );
}

export function SettingsToggleRow({
  label,
  description,
  value,
  onToggle,
  children,
  disabled = false,
}: {
  label: string;
  description: string;
  value: boolean;
  onToggle: (value: boolean) => void;
  children?: ReactNode;
  disabled?: boolean;
}) {
  const [gray500, emerald500, white] = Uniwind.getCSSVariable([
    "--color-gray-500",
    "--color-emerald-500",
    "--color-white",
  ]) as string[];
  return (
    <HStack
      className={cn(
        "items-center gap-x-4 py-4 justify-between",
        disabled && "opacity-50",
      )}
    >
      <VStack className="gap-y-2 w-3/5">
        <Heading className="text-white font-normal" size="md">
          {label}
        </Heading>
        <Text className="text-primary-100 text-sm">{description}</Text>
        {children}
      </VStack>
      <Switch
        size="md"
        isDisabled={disabled}
        trackColor={{
          false: gray500,
          true: emerald500,
        }}
        thumbColor={white}
        ios_backgroundColor={white}
        value={value}
        onToggle={onToggle}
      />
    </HStack>
  );
}

export function SettingsActionRow({
  label,
  description,
  actionLabel,
  onPress,
  variant = "primary",
  layout = "split",
  disabled = false,
}: {
  label: string;
  description: string;
  actionLabel: string;
  onPress: () => void;
  variant?: "primary" | "danger";
  layout?: "split" | "wide";
  disabled?: boolean;
}) {
  const buttonColor = disabled
    ? "border-primary-500 bg-primary-500"
    : variant === "danger"
      ? "border-red-500 bg-red-500"
      : "border-emerald-500 bg-emerald-500";
  const buttonTextColor = disabled ? "text-primary-300" : "text-primary-800";
  if (layout === "wide") {
    return (
      <HStack
        className={cn(
          "items-center gap-x-4 py-4 justify-between",
          disabled && "opacity-50",
        )}
      >
        <VStack className="gap-y-2 w-3/5">
          <Heading className="text-white font-normal" size="md">
            {label}
          </Heading>
          <Text className="text-primary-100 text-sm">{description}</Text>
        </VStack>
        <FadeOutScaleDown
          onPress={onPress}
          disabled={disabled}
          disabledOpacity={1}
          className={cn(
            "items-center justify-center py-2 px-8 border rounded-full",
            buttonColor,
          )}
        >
          <Text className={cn("font-bold text-lg", buttonTextColor)}>
            {actionLabel}
          </Text>
        </FadeOutScaleDown>
      </HStack>
    );
  }
  return (
    <HStack
      className={cn(
        "items-center gap-x-4 py-4 justify-between flex-1",
        disabled && "opacity-50",
      )}
    >
      <VStack className="gap-y-2 w-1/2">
        <Heading className="text-white font-normal" size="md">
          {label}
        </Heading>
        <Text className="text-primary-100 text-sm">{description}</Text>
      </VStack>
      <FadeOutScaleDown
        onPress={onPress}
        disabled={disabled}
        disabledOpacity={1}
        className={cn(
          "flex-1 items-center justify-center py-2 px-8 border rounded-full",
          buttonColor,
        )}
      >
        <Text
          numberOfLines={1}
          className={cn("font-bold text-lg", buttonTextColor)}
        >
          {actionLabel}
        </Text>
      </FadeOutScaleDown>
    </HStack>
  );
}

export function SettingsSelectRow({
  label,
  description,
  badgeText,
  onPress,
  disabled = false,
  highlighted = false,
}: {
  label: string;
  description: string;
  badgeText: string;
  onPress: () => void;
  disabled?: boolean;
  // Set when the screen was opened to point at this row: it flashes a backdrop
  // that fades away, so the row the caller meant is obvious on arrival.
  highlighted?: boolean;
}) {
  const [primary600] = Uniwind.getCSSVariable([
    "--color-primary-600",
  ]) as string[];
  const highlight = useSharedValue(highlighted ? 1 : 0);

  useEffect(() => {
    if (!highlighted) return;
    highlight.value = 1;
    highlight.value = withDelay(
      HIGHLIGHT_HOLD_MS,
      withTiming(0, { duration: HIGHLIGHT_FADE_MS }),
    );
  }, [highlighted, highlight]);

  const highlightStyle = useAnimatedStyle(() => ({
    opacity: highlight.value,
  }));

  return (
    <FadeOutScaleDown onPress={onPress} disabled={disabled}>
      <Box>
        <Animated.View
          pointerEvents="none"
          style={[
            HIGHLIGHT_BACKDROP,
            { backgroundColor: primary600 },
            highlightStyle,
          ]}
        />
        <HStack className="items-center gap-x-4 py-4 justify-between">
          <VStack className="gap-y-2 w-1/2">
            <Heading className="text-white font-normal" size="md">
              {label}
            </Heading>
            <Text className="text-primary-100 text-sm">{description}</Text>
          </VStack>
          <Badge
            className="rounded-full normal-case py-1 px-3 bg-emerald-100"
            size="lg"
            variant="solid"
            action="success"
          >
            <BadgeText className="normal-case text-center text-emerald-700">
              {badgeText}
            </BadgeText>
          </Badge>
        </HStack>
      </Box>
    </FadeOutScaleDown>
  );
}

export function SettingsStepperRow({
  label,
  description,
  valueText,
  onDecrement,
  onIncrement,
  valueClassName,
  disabled = false,
}: {
  label: string;
  description: string;
  valueText: string;
  onDecrement: () => void;
  onIncrement: () => void;
  valueClassName?: string;
  disabled?: boolean;
}) {
  return (
    <HStack
      className={cn(
        "items-center gap-x-4 py-4 justify-between",
        disabled && "opacity-50",
      )}
    >
      <VStack className="gap-y-2 w-1/2">
        <Heading className="text-white font-normal" size="md">
          {label}
        </Heading>
        <Text className="text-primary-100 text-sm">{description}</Text>
      </VStack>
      <HStack className="items-center gap-x-3">
        <FadeOutScaleDown
          onPress={onDecrement}
          disabled={disabled}
          disabledOpacity={1}
          className="items-center justify-center w-10 h-10 border border-emerald-500 bg-emerald-500 rounded-full"
        >
          <Text className="text-primary-800 font-bold text-lg">-</Text>
        </FadeOutScaleDown>
        <Text
          className={cn("text-white font-bold text-center", valueClassName)}
        >
          {valueText}
        </Text>
        <FadeOutScaleDown
          onPress={onIncrement}
          disabled={disabled}
          disabledOpacity={1}
          className="items-center justify-center w-10 h-10 border border-emerald-500 bg-emerald-500 rounded-full"
        >
          <Text className="text-primary-800 font-bold text-lg">+</Text>
        </FadeOutScaleDown>
      </HStack>
    </HStack>
  );
}

export function SettingsSliderRow({
  label,
  description,
  value,
  min = 0,
  max = 10000,
  step = 100,
  onValueChange,
  disabled = false,
}: {
  label: string;
  description: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onValueChange: (value: number) => void;
  disabled?: boolean;
}) {
  const [primary400, white] = Uniwind.getCSSVariable([
    "--color-primary-400",
    "--color-white",
  ]) as string[];

  const fill = white ?? "white";
  const track = primary400 ?? "rgba(255,255,255,0.3)";

  const widthSV = useSharedValue(0);
  const displayFrac = useSharedValue(0);
  const sliderId = useId();
  const isDragging = useRef(false);

  // Sync the shared value when the controlled `value` changes from outside.
  useEffect(() => {
    displayFrac.value = Math.min(1, Math.max(0, (value - min) / (max - min)));
  }, [value, min, max]);

  const handlePan = useCallback(
    (x: number, layoutWidth: number) => {
      if (layoutWidth <= 0) return;
      const frac = Math.min(1, Math.max(0, x / layoutWidth));
      displayFrac.value = frac;
      const steppedValue = min + Math.round(frac * (max - min) / step) * step;
      onValueChange(Math.min(max, Math.max(min, steppedValue)));
    },
    [min, max, step, onValueChange],
  );

  const fillStyle = useAnimatedStyle(() => {
    const usable = Math.max(0, widthSV.value - THUMB_SIZE);
    return { width: displayFrac.value * usable + THUMB_SIZE / 2 };
  });

  const thumbStyle = useAnimatedStyle(() => {
    const usable = Math.max(0, widthSV.value - THUMB_SIZE);
    return { transform: [{ translateX: displayFrac.value * usable }] };
  });

  return (
    <HStack
      className={cn(
        "items-center gap-x-4 py-4 justify-between",
        disabled && "opacity-50",
      )}
    >
      <VStack className="gap-y-2 w-1/2">
        <Heading className="text-white font-normal" size="md">
          {label}
        </Heading>
        <Text className="text-primary-100 text-sm">{description}</Text>
      </VStack>
      <HStack className="items-center gap-x-3 flex-1">
        {/* Slider track */}
        <View
          key={sliderId}
          style={{ flex: 1, height: CONTAINER_HEIGHT, justifyContent: "center" }}
          onLayout={(e: LayoutChangeEvent) => {
            widthSV.value = e.nativeEvent.layout.width;
          }}
          onStartShouldSetResponder={() => true}
          onMoveShouldRespondResponder={() => !isDragging.current}
          onResponderMove={(event) => {
            if (!isDragging.current) isDragging.current = true;
            const { x } = event.nativeEvent;
            handlePan(x, widthSV.value || 1);
          }}
          onResponderRelease={() => {
            isDragging.current = false;
          }}
        >
          {/* Track background */}
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: TRACK_TOP,
              height: TRACK_HEIGHT,
              borderRadius: TRACK_HEIGHT / 2,
              backgroundColor: track,
            }}
          />
          {/* Fill */}
          <Animated.View
            style={[
              {
                position: "absolute",
                left: 0,
                top: TRACK_TOP,
                height: TRACK_HEIGHT,
                borderRadius: TRACK_HEIGHT / 2,
                backgroundColor: fill,
              },
              fillStyle,
            ]}
          />
          {/* Thumb */}
          <Animated.View
            style={[
              {
                position: "absolute",
                left: 0,
                top: THUMB_TOP,
                width: THUMB_SIZE,
                height: THUMB_SIZE,
                borderRadius: THUMB_SIZE / 2,
                backgroundColor: "white",
              },
              thumbStyle,
            ]}
          />
        </View>
        {/* Value label */}
        <Text className="text-white font-bold text-sm min-w-[36px] text-right">
          {value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value}ms`}
        </Text>
      </HStack>
    </HStack>
  );
}