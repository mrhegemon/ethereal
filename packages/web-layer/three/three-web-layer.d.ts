import { Vector3, Object3D, Mesh, MeshBasicMaterial, MeshDepthMaterial, Geometry, Camera, Intersection, Texture, Matrix4, WebGLRenderer } from 'three';
import { WebLayer } from '../web-renderer';
import { Bounds } from '../dom-utils';
export interface WebLayer3DOptions {
    pixelRatio?: number;
    layerSeparation?: number;
    autoRefresh?: boolean;
    onLayerCreate?(layer: WebLayer3DBase): void;
    onAfterRasterize?(layer: WebLayer3DBase): void;
}
export declare type WebLayerHit = ReturnType<typeof WebLayer3D.prototype.hitTest> & {};
export declare class WebLayer3DBase extends Object3D {
    options: WebLayer3DOptions;
    element: Element;
    constructor(elementOrHTML: Element | string, options?: WebLayer3DOptions);
    protected _webLayer: WebLayer;
    textures: Map<HTMLCanvasElement | HTMLVideoElement, Texture>;
    get currentTexture(): Texture;
    textureNeedsUpdate: boolean;
    contentMesh: Mesh<Geometry, MeshBasicMaterial>;
    cursor: Object3D;
    depthMaterial: MeshDepthMaterial;
    domLayout: Object3D;
    domSize: Vector3;
    get needsRefresh(): boolean;
    set needsRefresh(value: boolean);
    /**
     * Get the hover state
     */
    get hover(): boolean;
    /**
     * Get the layer depth (distance from this layer's element and the parent layer's element)
     */
    get depth(): number;
    /**
     *
     */
    get index(): number;
    /** If true, this layer needs to be removed from the scene */
    get needsRemoval(): boolean;
    get bounds(): Bounds;
    get parentWebLayer(): WebLayer3DBase | undefined;
    childWebLayers: WebLayer3DBase[];
    /**
     * Specifies whether or not the DOM layout should be applied.
     *
     * When set to `true`, the dom layout should always be applied.
     * When set to `false`, the dom layout should never be applied.
     * When set to `'auto'`, the dom layout should only be applied
     * when the `parentLayer` is the same as the `parent` object.
     *
     * It is the responsibiltiy of the update callback
     * to follow these rules.
     *
     * Defaults to `auto`
     */
    shouldApplyDOMLayout: true | false | 'auto';
    /**
     * Refresh from DOM
     */
    refresh(recurse?: boolean): void;
    updateLayout(): void;
    updateContent(): void;
    querySelector(selector: string): WebLayer3DBase | undefined;
    traverseParentWebLayers<T extends any[]>(each: (layer: WebLayer3DBase, ...params: T) => void, ...params: T): void;
    traverseWebLayers<T extends any[]>(each: (layer: WebLayer3DBase, ...params: T) => void, ...params: T): void;
    traverseChildWebLayers<T extends any[]>(each: (layer: WebLayer3DBase, ...params: T) => void, ...params: T): T;
    dispose(): void;
    private _refreshVideoBounds;
    private _refreshDOMLayout;
}
/**
 * Transform a DOM tree into 3D layers.
 *
 * When an instance is created, a `layer` data-attribute is set on the
 * the passed DOM element to match this instance's Object3D id.
 * If the passed DOM element has an `id` attribute, this instance's Object3D name
 * will be set to match the element id.
 *
 * Child WebLayer3D instances can be specified with an empty `layer` data-attribute,
 * which will be set when the child WebLayer3D instance is created automatically.
 * The data-attribute can be specified added in HTML or dynamically:
 *  - `<div data-layer></div>`
 *  - `element.dataset.layer = ''`
 *
 * Additionally, the pixel ratio can be adjusted on each layer, individually:
 *  - `<div data-layer data-layer-pixel-ratio="0.5"></div>`
 *  - `element.dataset.layerPixelRatio = '0.5'`
 *
 * Finally, each layer can prerender multipe states specified as CSS classes delimited by spaces:
 *  - `<div data-layer data-layer-states="near far"></div>`
 *  - `element.dataset.layerStates = 'near far'`
 *
 * Each WebLayer3D will render each of its states with the corresponding CSS class applied to the element.
 * The texture state can be changed by alternating between the specified classes,
 * without requiring the DOM to be re-rendered. Setting a state on a parent layer does
 * not affect the state of a child layer.
 *
 * Every layer has an implicit `hover` state which can be mixed with any other declared state,
 * by using the appropriate CSS selector: `.near.hover` or `.far.hover`. Besides than the
 * `hover` state. The hover state is controlled by interaction rays, which can be provided
 * with the `interactionRays` property.
 *
 * Default dimensions: 1px = 0.001 world dimensions = 1mm (assuming meters)
 *     e.g., 500px width means 0.5meters
 */
export declare class WebLayer3D extends WebLayer3DBase {
    options: WebLayer3DOptions;
    static layersByElement: WeakMap<Element, WebLayer3DBase>;
    static layersByMesh: WeakMap<Mesh<Geometry | import("three").BufferGeometry, import("three").Material | import("three").Material[]>, WebLayer3DBase>;
    static DEBUG_PERFORMANCE: boolean;
    static LAYER_ATTRIBUTE: string;
    static PIXEL_RATIO_ATTRIBUTE: string;
    static STATES_ATTRIBUTE: string;
    static HOVER_DEPTH_ATTRIBUTE: string;
    static DEFAULT_LAYER_SEPARATION: number;
    static DEFAULT_PIXELS_PER_UNIT: number;
    static GEOMETRY: Geometry;
    static computeNaturalDistance(projection: Matrix4 | Camera, renderer: WebGLRenderer): number;
    static shouldApplyDOMLayout(layer: WebLayer3DBase): boolean;
    private _doRecursiveRefresh;
    scheduleRefresh(): void;
    private static _hideCursor;
    get parentWebLayer(): WebLayer3DBase;
    private _interactionRays;
    private _raycaster;
    private _hitIntersections;
    constructor(elementOrHTML: Element | string, options?: WebLayer3DOptions);
    /**
     * A list of Rays to be used for interaction.
     * Can only be set on a root WebLayer3D instance.
     */
    get interactionRays(): Array<THREE.Ray | THREE.Object3D>;
    set interactionRays(rays: Array<THREE.Ray | THREE.Object3D>);
    /**
     * Update the pose and opacity of this layer, handle interactions,
     * and schedule DOM refreshes. This should be called each frame.
     */
    updateLayout(): void;
    updateContent(): void;
    /**
     * Update this layer and child layers, recursively
     */
    updateAll(): void;
    private _updateInteractions;
    static getLayerForQuery(selector: string): WebLayer3DBase | undefined;
    static getClosestLayerForElement(element: Element): WebLayer3DBase | undefined;
    hitTest(ray: THREE.Ray): {
        layer: WebLayer3DBase;
        intersection: Intersection;
        target: HTMLElement;
    } | undefined;
}
