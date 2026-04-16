"use client";

import { useRef, type Ref } from "react";

import { AnimatedBeam } from "@/components/ui/animated-beam";
import { GoogleDrive } from "@/components/icons/drive";
import { Gmail } from "@/components/icons/gmail";
import { GoogleCalendar } from "@/components/icons/google-calendar";
import { Notion } from "@/components/icons/notion";
import { OpenClaw } from "@/components/icons/openclaw";
import { Slack } from "@/components/icons/slack";
import { Telegram } from "@/components/icons/telegram";
import { WhatsApp } from "@/components/icons/whatsapp";
import { cn } from "@/lib/utils";

function Circle({
  ref,
  className,
  children,
}: {
  ref?: Ref<HTMLDivElement>;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      ref={ref}
      className={cn(
        "z-10 flex size-12 items-center justify-center rounded-full border-2 border-border bg-card p-2 shadow-[0_0_20px_-12px_rgba(0,0,0,0.8)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ToolsBeam({
  ariaLabel,
  centerLabel,
}: {
  ariaLabel: string;
  centerLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Left column — messaging channels (input)
  const telegramRef = useRef<HTMLDivElement>(null);
  const slackRef = useRef<HTMLDivElement>(null);
  const whatsappRef = useRef<HTMLDivElement>(null);

  // Centre — agent runtime
  const centerRef = useRef<HTMLDivElement>(null);

  // Right column — productivity tools (output)
  const gmailRef = useRef<HTMLDivElement>(null);
  const notionRef = useRef<HTMLDivElement>(null);
  const driveRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      className="relative mx-auto flex h-[200px] w-full items-center justify-center overflow-hidden"
    >
      <div className="flex size-full max-w-3xl flex-row items-stretch justify-between gap-10">
        {/* Left column — channels */}
        <div className="flex flex-col justify-between">
          <Circle ref={telegramRef}>
            <Telegram className="size-7" />
          </Circle>
          <Circle ref={slackRef}>
            <Slack className="size-6" />
          </Circle>
          <Circle ref={whatsappRef}>
            <WhatsApp className="size-7" />
          </Circle>
        </div>

        {/* Centre — OpenClaw */}
        <div className="flex flex-col justify-center">
          <Circle ref={centerRef} className="size-16" aria-label={centerLabel}>
            <OpenClaw className="size-10" />
          </Circle>
        </div>

        {/* Right column — productivity tools */}
        <div className="flex flex-col justify-between">
          <Circle ref={gmailRef}>
            <Gmail className="size-6" />
          </Circle>
          <Circle ref={notionRef}>
            <Notion className="size-6" />
          </Circle>
          <Circle ref={driveRef}>
            <GoogleDrive className="size-6" />
          </Circle>
          <Circle ref={calendarRef}>
            <GoogleCalendar className="size-6" />
          </Circle>
        </div>
      </div>

      {/* Channels → OpenClaw (left to centre, default direction) */}
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={telegramRef}
        toRef={centerRef}
        curvature={-75}
        endYOffset={-10}
        delay={0}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={slackRef}
        toRef={centerRef}
        delay={0.4}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={whatsappRef}
        toRef={centerRef}
        curvature={75}
        endYOffset={10}
        delay={0.8}
      />

      {/* OpenClaw → productivity tools (centre to right, reverse animation) */}
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={centerRef}
        toRef={gmailRef}
        curvature={-90}
        endYOffset={-15}
        reverse
        delay={1.2}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={centerRef}
        toRef={notionRef}
        curvature={-30}
        endYOffset={-5}
        reverse
        delay={1.6}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={centerRef}
        toRef={driveRef}
        curvature={30}
        endYOffset={5}
        reverse
        delay={2}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={centerRef}
        toRef={calendarRef}
        curvature={90}
        endYOffset={15}
        reverse
        delay={2.4}
      />
    </div>
  );
}
