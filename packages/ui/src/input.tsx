import * as React from 'react';
import { cn } from './utils.js';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, leftAddon, rightAddon, type = 'text', ...props }, ref) => {
    return (
      <div className="w-full">
        <div className="relative flex items-center">
          {leftAddon ? (
            <span className="pointer-events-none absolute left-3 text-navy-400">{leftAddon}</span>
          ) : null}
          <input
            ref={ref}
            type={type}
            className={cn(
              'flex h-11 w-full rounded-lg border border-navy-200 bg-white px-4 py-2 text-sm text-navy-900 placeholder:text-navy-400 transition-colors',
              'focus:border-electric-500 focus:outline-none focus:ring-2 focus:ring-electric-500/20',
              'disabled:cursor-not-allowed disabled:bg-navy-50 disabled:opacity-60',
              leftAddon && 'pl-10',
              rightAddon && 'pr-10',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
              className,
            )}
            aria-invalid={error ? 'true' : undefined}
            {...props}
          />
          {rightAddon ? <span className="absolute right-3 text-navy-400">{rightAddon}</span> : null}
        </div>
        {error ? <p className="mt-1.5 text-sm text-red-600">{error}</p> : null}
      </div>
    );
  },
);
Input.displayName = 'Input';
