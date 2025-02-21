import { EventCallback, WebLayer } from './WebLayer';
import { Matrix4 } from 'three/src/math/Matrix4';
export interface WebLayerOptions {
    /**
     * Inject and apply only these stylesheets.
     * This only has an effect when passing a detached DOM element
     * as the root of the Layer tree. This dom element will be
     * hosted inside an iframe, along with the provided stylesheets,
     * for style isolation.
     */
    styleSheetURLs?: string[];
}
export declare type RequestIdleCallbackDeadline = {
    readonly didTimeout: boolean;
    timeRemaining: () => number;
};
export declare class WebRenderer {
    static ATTRIBUTE_PREFIX: string;
    static get ELEMENT_UID_ATTRIBUTE(): string;
    static get HOVER_ATTRIBUTE(): string;
    static get ACTIVE_ATTRIBUTE(): string;
    static get FOCUS_ATTRIBUTE(): string;
    static get TARGET_ATTRIBUTE(): string;
    static get LAYER_ATTRIBUTE(): string;
    static get PIXEL_RATIO_ATTRIBUTE(): string;
    static get RENDERING_ATTRIBUTE(): string;
    static get RENDERING_PARENT_ATTRIBUTE(): string;
    static get RENDERING_CONTAINER_ATTRIBUTE(): string;
    static get RENDERING_INLINE_ATTRIBUTE(): string;
    static get RENDERING_DOCUMENT_ATTRIBUTE(): string;
    private static _nextUID;
    static generateElementUID(): string;
    static serializer: XMLSerializer;
    static rootLayers: Map<Element, WebLayer>;
    static layers: Map<Element, WebLayer>;
    private static mutationObservers;
    private static resizeObservers;
    static serializeQueue: WebLayer[];
    static rasterizeQueue: WebLayer[];
    static renderQueue: WebLayer[];
    static readonly focusElement: HTMLElement | null;
    static readonly activeElement: Element | null;
    static readonly targetElement: Element | null;
    static getPsuedoAttributes(states: typeof WebLayer.prototype.pseudoStates): string;
    static rootNodeObservers: Map<Document | ShadowRoot, MutationObserver>;
    static containerStyleElement: HTMLStyleElement;
    static initRootNodeObservation(element: Element): void;
    static addToSerializeQueue(layer: WebLayer): void;
    static addToRasterizeQueue(layer: WebLayer): void;
    static addToRenderQueue(layer: WebLayer): void;
    static TASK_ASYNC_MAX_COUNT: number;
    static TASK_SYNC_MAX_TIME: number;
    static rasterizeTaskCount: number;
    private static _runTasks;
    static tasksPending: boolean;
    static scheduleTasksIfNeeded(): void;
    static scheduleIdle(cb: (deadline?: RequestIdleCallbackDeadline) => any): void;
    static setLayerNeedsRefresh(layer: WebLayer): void;
    static createLayerTree(element: Element, hostingOptions: WebLayerOptions, eventCallback: EventCallback): WebLayer;
    static disposeLayer(layer: WebLayer): void;
    static getClosestLayer(element: Element, inclusive?: boolean): WebLayer | undefined;
    static parseCSSTransform(computedStyle: CSSStyleDeclaration, width: number, height: number, pixelSize: number, out?: Matrix4): Matrix4 | null;
    static pauseMutationObservers(): void;
    static resumeMutationObservers(): void;
    private static startMutationObserver;
    private static _handleMutations;
    private static _triggerRefresh;
    private static _addDynamicPseudoClassRules;
    static arrayBufferToBase64(bytes: Uint8Array): string;
    static attributeCSS(name: string, value?: string): string;
    static attributeHTML(name: string, value?: string): string;
    static generateEmbeddedCSS(url: string, css: string): Promise<string>;
    private static embeddedStyles;
    private static fontStyles;
    static getAllEmbeddedStyles(el: Element): Promise<string[]>;
    static deleteEmbeddedStyle(style: HTMLStyleElement): void;
    static dataURLMap: Map<string, Promise<string>>;
    static getDataURL(url: string, accept?: string): Promise<string>;
    static embeddedCSSMap: Map<string, string>;
    static getEmbeddedCSS(url: string): Promise<string>;
    static updateInputAttributes(element: Element): void;
    static _updateInputAttribute(inputElement: HTMLInputElement): void;
    static isBlankImage(imageData: Uint8ClampedArray): boolean;
}
