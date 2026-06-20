declare module 'react-simple-maps' {
  import type { ReactNode, CSSProperties } from 'react';

  export type GeographyProps = {
    geography: unknown;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    fillOpacity?: number;
    className?: string;
    style?: {
      default?: CSSProperties;
      hover?: CSSProperties;
      pressed?: CSSProperties;
    };
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
  };

  export function Geography(props: GeographyProps): JSX.Element;

  export type MarkerProps = {
    coordinates: [number, number];
    children?: ReactNode;
  };

  export function Marker(props: MarkerProps): JSX.Element;

  export type ComposableMapProps = {
    projection?: string;
    width?: number;
    height?: number;
    className?: string;
    children?: ReactNode;
  };

  export function ComposableMap(props: ComposableMapProps): JSX.Element;

  export type GeographiesProps = {
    geography: string | object;
    children: (args: { geographies: Array<{ rsmKey: string; svgPath: string; properties?: Record<string, string> }> }) => ReactNode;
  };

  export function Geographies(props: GeographiesProps): JSX.Element;
}
