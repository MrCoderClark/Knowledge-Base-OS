"use client";

import { useState, useTransition } from "react";
import { setCourseFlagsAction } from "@/server/kb/course-actions";

function Toggle({
  on,
  onClick,
  disabled,
}: {
  on: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        on ? "bg-indigo" : "bg-nav-active"
      }`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function CourseSettings({
  courseId,
  required: initialRequired,
  antiSkip: initialAntiSkip,
}: {
  courseId: string;
  required: boolean;
  antiSkip: boolean;
}) {
  const [required, setRequired] = useState(initialRequired);
  const [antiSkip, setAntiSkip] = useState(initialAntiSkip);
  const [pending, startTransition] = useTransition();

  function save(nextRequired: boolean, nextAntiSkip: boolean) {
    setRequired(nextRequired);
    setAntiSkip(nextAntiSkip);
    startTransition(async () => {
      await setCourseFlagsAction(courseId, nextRequired, nextAntiSkip);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-heading">
            Required training
          </div>
          <div className="text-sm text-body">
            Track completion in the compliance dashboard.
          </div>
        </div>
        <Toggle
          on={required}
          disabled={pending}
          onClick={() => save(!required, antiSkip)}
        />
      </div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-heading">
            Prevent skipping ahead
          </div>
          <div className="text-sm text-body">
            Learners can&apos;t seek past unwatched content, so completion means
            genuinely watched.
          </div>
        </div>
        <Toggle
          on={antiSkip}
          disabled={pending}
          onClick={() => save(required, !antiSkip)}
        />
      </div>
    </div>
  );
}
