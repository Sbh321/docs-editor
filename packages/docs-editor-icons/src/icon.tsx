import type { ReactNode, SVGProps } from "react";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  /**
   * The icon's edge length, applied to both width and height. Defaults to
   * `"1em"` so icons scale with the surrounding font size — drop them into a
   * button and they match its text without extra styling.
   */
  readonly size?: number | string;
  /**
   * An accessible label. When provided, the icon is exposed to assistive
   * technology as an image with this label; when omitted (the default), the
   * icon is decorative and hidden from screen readers — appropriate when an
   * adjacent visible label or `aria-label` already names the control.
   */
  readonly title?: string;
}

/**
 * The shared `<svg>` shell every Docs Editor icon renders through — a stroked,
 * `currentColor` glyph on a 24×24 grid. Exported so consumers can build their
 * own icons that match the bundled set:
 *
 * ```tsx
 * const StarIcon = (props: IconProps) => (
 *   <Icon {...props}>
 *     <path d="M12 3l2.9 6 6.1.9-4.5 4.3 1 6.1L12 17.8 6.5 20.4l1-6.1L3 9.9 9.1 9z" />
 *   </Icon>
 * );
 * ```
 *
 * Nothing here forces a color or size beyond the `currentColor`/`1em`
 * defaults, keeping the set headless — a theme or the surrounding text drives
 * both.
 */
export function Icon({
  size = "1em",
  title,
  children,
  ...rest
}: IconProps & { readonly children: ReactNode }): ReactNode {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...(title
        ? { role: "img", "aria-label": title }
        : { "aria-hidden": true, focusable: false })}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}
