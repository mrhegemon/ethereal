import {
  Vector3, 
  Object3D, 
  Mesh,
  MeshBasicMaterial,
  MeshDepthMaterial,
  PlaneGeometry,
  Geometry,
  Camera,
  Ray,
  Raycaster,
  Intersection,
  Texture, 
  VideoTexture, 
  ClampToEdgeWrapping, 
  RGBADepthPacking,
  LinearFilter,
  Matrix4,
  WebGLRenderer
} from 'three'

import { WebRenderer, WebLayer } from '../web-renderer'

import {Bounds, getBounds, getViewportBounds, traverseChildElements, DOM } from '../dom-utils'

export interface WebLayer3DOptions {
  pixelRatio?: number
  layerSeparation?: number
  autoRefresh?: boolean
  onLayerCreate?(layer: WebLayer3DBase): void
  onAfterRasterize?(layer: WebLayer3DBase): void
}

export type WebLayerHit = ReturnType<typeof WebLayer3D.prototype.hitTest> & {}

const scratchVector = new Vector3()
const scratchVector2 = new Vector3()
const scratchBounds = new Bounds()
const scratchBounds2 = new Bounds()

export class WebLayer3DBase extends Object3D {
  public element:Element
  constructor(elementOrHTML: Element|string, public options: WebLayer3DOptions = {}) {
    super()
    const element = this.element = typeof elementOrHTML === 'string' ? DOM(elementOrHTML) : elementOrHTML
    this.name = element.id
    this._webLayer = WebRenderer.getClosestLayer(element)!

    this.add(this.contentMesh)
    this.add(this.cursor)
    this.cursor.visible = false
    this.contentMesh.visible = false
    this.contentMesh['customDepthMaterial'] = this.depthMaterial

    WebLayer3D.layersByElement.set(this.element, this)
    WebLayer3D.layersByMesh.set(this.contentMesh, this)
  }

  protected _webLayer : WebLayer

  textures = new Map<HTMLCanvasElement | HTMLVideoElement, Texture>()

  get currentTexture() {
    if (this._webLayer.element.tagName === 'VIDEO') {
      const video = this._webLayer.element as HTMLVideoElement
      let t = this.textures.get(video)
      if (!t) {
        t = new VideoTexture(video)
        t.wrapS = ClampToEdgeWrapping
        t.wrapT = ClampToEdgeWrapping
        t.minFilter = LinearFilter
        this.textures.set(video, t)
      }
      return t
    }

    const canvas = this._webLayer.canvas
    let t = this.textures.get(canvas)
    if (!t) {
      t = new Texture(canvas)
      t.needsUpdate = true
      t.wrapS = ClampToEdgeWrapping
      t.wrapT = ClampToEdgeWrapping
      t.minFilter = LinearFilter
      this.textures.set(canvas, t)
    } else if (this.textureNeedsUpdate) {
      this.textureNeedsUpdate = false
      t.needsUpdate = true
    }
    return t
  }

  textureNeedsUpdate = false

  // content = new Object3D()
  contentMesh = new Mesh(
    WebLayer3D.GEOMETRY,
    new MeshBasicMaterial({
      transparent: true,
      alphaTest: 0.001,
      opacity: 1
    })
  )

  cursor = new Object3D()

  depthMaterial = new MeshDepthMaterial({
    depthPacking: RGBADepthPacking,
    alphaTest: 0.01
  } as any)

  domLayout = new Object3D()
  domSize = new Vector3(1,1,1)

  get needsRefresh() {
    return this._webLayer.needsRefresh
  }

  set needsRefresh(value) {
    this._webLayer.needsRefresh = value
  }

  /**
   * Get the hover state
   */
  get hover() {
    return WebRenderer.containsHover(this.element)
  }

  /**
   * Get the layer depth (distance from this layer's element and the parent layer's element)
   */
  get depth() {
    return this._webLayer.depth
  }

  /**
   *
   */
  get index() {
    return this.parentWebLayer ? this.parentWebLayer.childWebLayers.indexOf(this) : 0
  }

  /** If true, this layer needs to be removed from the scene */
  get needsRemoval() {
    return this._webLayer.needsRemoval
  }

  get bounds() {
    return this._webLayer.bounds
  }

  get parentWebLayer(): WebLayer3DBase | undefined {
    return (
      this._webLayer.parentLayer &&
      WebLayer3D.layersByElement.get(this._webLayer.parentLayer.element)
    )
  }

  childWebLayers: WebLayer3DBase[] = []

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
  shouldApplyDOMLayout: true | false | 'auto' = 'auto'

  /**
   * Refresh from DOM
   */
  refresh(recurse=false) {
    this._webLayer.refresh()
    this.childWebLayers.length = 0
    for (const c of this._webLayer.childLayers) {
      const child = WebLayer3D.getClosestLayerForElement(c.element)
      if (!child) continue
      this.childWebLayers.push(child)
      child.refresh(recurse)
    }
    this._refreshVideoBounds()
    this._refreshDOMLayout()
  }

  updateLayout() {
    this.position.copy(this.domLayout.position)
    this.quaternion.copy(this.domLayout.quaternion)
    this.scale.copy(this.domLayout.scale)
    this.contentMesh.scale.copy(this.domSize)
    // handle layer visibiltiy or removal
    const mesh = this.contentMesh
    const childMaterial = mesh.material as THREE.MeshBasicMaterial
    const isHidden = childMaterial.opacity < 0.005
    if (isHidden) mesh.visible = false
    else if (mesh.material.map) mesh.visible = true
    if (this.needsRemoval && isHidden) {
      if (this.parent) this.parent.remove(this)
      this.dispose()
    }
  }

  updateContent() {
    // update mesh properties
    const mesh = this.contentMesh
    mesh.renderOrder = this.depth + this.index * 0.001

    // update texture
    const texture = this.currentTexture
    const material = mesh.material as THREE.MeshBasicMaterial
    if (texture.image && material.map !== texture) {
      material.map = texture
      material.needsUpdate = true
      this.depthMaterial['map'] = texture
      this.depthMaterial.needsUpdate = true
    }
  }

  querySelector(selector: string): WebLayer3DBase | undefined {
    const element = this.element.querySelector(selector)
    if (element) {
      return WebLayer3D.layersByElement.get(element)
    }
    return undefined
  }

  traverseParentWebLayers<T extends any[]>(
    each: (layer: WebLayer3DBase, ...params: T) => void,
    ...params: T
  ) {
    const parentLayer = this.parentWebLayer
    if (parentLayer) {
      parentLayer.traverseParentWebLayers(each, ...params)
      each(parentLayer, ...params)
    }
  }

  traverseWebLayers<T extends any[]>(
    each: (layer: WebLayer3DBase, ...params: T) => void,
    ...params: T
  ) {
    each(this, ...params)
    this.traverseChildWebLayers(each, ...params)
  }

  traverseChildWebLayers<T extends any[]>(
    each: (layer: WebLayer3DBase, ...params: T) => void,
    ...params: T
  ) {
    for (const child of this.childWebLayers) {
      child.traverseWebLayers(each, ...params)
    }
    return params
  }

  dispose() {
    for (const t of this.textures.values()) {
      t.dispose()
    }
    this.contentMesh.geometry.dispose()
    WebRenderer.disposeLayer(this._webLayer)
    for (const child of this.childWebLayers) child.dispose()
  }

  private _refreshVideoBounds() {
    if (this.element.nodeName === 'VIDEO') {
      const video = this.element as HTMLVideoElement
      const texture = this.currentTexture
      const computedStyle = getComputedStyle(this.element)
      const { objectFit } = computedStyle
      const { width: viewWidth, height: viewHeight } = this.bounds
      const { videoWidth, videoHeight } = video
      const videoRatio = videoWidth / videoHeight
      const viewRatio = viewWidth / viewHeight
      texture.center.set(0.5, 0.5)
      switch (objectFit) {
        case 'none':
          texture.repeat.set(viewWidth / videoWidth, viewHeight / videoHeight).clampScalar(0, 1)
          break
        case 'contain':
        case 'scale-down':
          texture.repeat.set(1, 1)
          if (viewRatio > videoRatio) {
            const width = this.bounds.height * videoRatio || 0
            this.bounds.left += (this.bounds.width - width) / 2
            this.bounds.width = width
          } else {
            const height = this.bounds.width / videoRatio || 0
            this.bounds.top += (this.bounds.height - height) / 2
            this.bounds.height = height
          }
          break
        case 'cover':
          texture.repeat.set(viewWidth / videoWidth, viewHeight / videoHeight)
          if (viewRatio < videoRatio) {
            const width = this.bounds.height * videoRatio || 0
            this.bounds.left += (this.bounds.width - width) / 2
            this.bounds.width = width
          } else {
            const height = this.bounds.width / videoRatio || 0
            this.bounds.top += (this.bounds.height - height) / 2
            this.bounds.height = height
          }
          break
        default:
        case 'fill':
          texture.repeat.set(1, 1)
          break
      }
    }
  }

  private _refreshDOMLayout() {

    if (this.needsRemoval) {
      return
    }

    this.domLayout.position.set(0,0,0)
    this.domLayout.scale.set(1, 1, 1)
    this.domLayout.quaternion.set(0, 0, 0, 1)

    const bounds = this.bounds
    const width = bounds.width
    const height = bounds.height
    const pixelSize = 1 / WebLayer3D.DEFAULT_PIXELS_PER_UNIT

    this.domSize.set(
      Math.max(pixelSize * width, 10e-6),
      Math.max(pixelSize * height, 10e-6),
      1
    )

    if (!WebLayer3D.shouldApplyDOMLayout(this)) return

    const parentBounds =
      this.parentWebLayer instanceof WebLayer3DBase
        ? this.parentWebLayer.bounds
        : getViewportBounds(scratchBounds)
    const parentWidth = parentBounds.width
    const parentHeight = parentBounds.height

    const leftEdge = -parentWidth / 2 + width / 2
    const topEdge = parentHeight / 2 - height / 2

    const sep = this.options.layerSeparation || WebLayer3D.DEFAULT_LAYER_SEPARATION
    
    this.domLayout.position.set(
      pixelSize * (leftEdge + bounds.left),
      pixelSize * (topEdge - bounds.top),
      this.depth * sep +
        (this.parentWebLayer ? this.parentWebLayer.index * sep * 0.01 : 0) +
        this.index * sep * 0.001
    )
  }
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
export class WebLayer3D extends WebLayer3DBase {

  static layersByElement = new WeakMap<Element, WebLayer3DBase>()
  static layersByMesh = new WeakMap<Mesh, WebLayer3DBase>()

  static DEBUG_PERFORMANCE = false
  static LAYER_ATTRIBUTE = 'data-layer'
  static PIXEL_RATIO_ATTRIBUTE = 'data-layer-pixel-ratio'
  static STATES_ATTRIBUTE = 'data-layer-states'
  static HOVER_DEPTH_ATTRIBUTE = 'data-layer-hover-depth'

  static DEFAULT_LAYER_SEPARATION = 0.001
  static DEFAULT_PIXELS_PER_UNIT = 1000
  static GEOMETRY = new PlaneGeometry(1, 1, 2, 2) as Geometry

  static computeNaturalDistance(
    projection: Matrix4 | Camera,
    renderer: WebGLRenderer
  ) {
    let projectionMatrix = projection as Matrix4
    if ((projection as Camera).isCamera) {
      projectionMatrix = (projection as Camera).projectionMatrix
    }
    const pixelRatio = renderer.getPixelRatio()
    const widthPixels = renderer.domElement.width / pixelRatio
    const width = WebLayer3D.DEFAULT_PIXELS_PER_UNIT * widthPixels
    const horizontalFOV = getFovs(projectionMatrix).horizontal
    const naturalDistance = width / 2 / Math.tan(horizontalFOV / 2)
    return naturalDistance
  }
  
  static shouldApplyDOMLayout(layer: WebLayer3DBase) {
    const should = layer.shouldApplyDOMLayout
    if ((should as any) === 'always' || should === true) return true
    if ((should as any) === 'never' || should === false) return false
    if (should === 'auto' && layer.parentWebLayer && layer.parent === layer.parentWebLayer) return true
    return false
  }

  private _doRecursiveRefresh = () => {
    this.refresh(true)
  }

  scheduleRefresh() {
    WebRenderer.scheduleIdle(this._doRecursiveRefresh)
  }

  private static _hideCursor = function(layer: WebLayer3DBase) {
    layer.cursor.visible = false
  }

  get parentWebLayer() {
    return super.parentWebLayer!
  }

  private _interactionRays = [] as Array<Ray | Object3D>
  private _raycaster = new Raycaster()
  private _hitIntersections = [] as Intersection[]

  constructor(elementOrHTML: Element|string, public options: WebLayer3DOptions = {}) {
    super(elementOrHTML, options)

    this._webLayer = WebRenderer.createLayerTree(this.element, (event, { target }) => {
      if (event === 'layercreated') {
        if (target === this.element) return
        const layer = new WebLayer3DBase(target, this.options)
        layer.parentWebLayer?.add(layer)
        if (this.options.onLayerCreate) this.options.onLayerCreate(layer)
      } else if (event === 'layerpainted') {
        const layer = WebRenderer.layers.get(target)!
        const layer3D = WebLayer3D.layersByElement.get(layer.element)!
        layer3D.textureNeedsUpdate = true
      } else if (event === 'layermoved') {
        const layer = WebLayer3D.layersByElement.get(target)!
        layer.parentWebLayer?.add(layer)
      }
    })
    if (this.options.onLayerCreate) this.options.onLayerCreate(this)
    this.refresh(true)
  }

  /**
   * A list of Rays to be used for interaction.
   * Can only be set on a root WebLayer3D instance.
   */
  get interactionRays() {
    return this._interactionRays
  }
  set interactionRays(rays: Array<THREE.Ray | THREE.Object3D>) {
    this._interactionRays = rays
  }

  /**
   * Update the pose and opacity of this layer, handle interactions, 
   * and schedule DOM refreshes. This should be called each frame.
   */
  updateLayout() {
    super.updateLayout()
  }

  updateContent() {
    super.updateContent()
    this._updateInteractions()
    if (this.options.autoRefresh && Math.random() > 0.5) this.scheduleRefresh()
  }

  /**
   * Update this layer and child layers, recursively
   */
  updateAll() {
    this.updateLayout()
    this.updateContent()
    for (const child of this.childWebLayers) {
      child.updateLayout()
      child.updateContent()
    }
  }

  private _updateInteractions() {
    const rootLayer = this
    rootLayer.updateWorldMatrix(true, true)
    rootLayer.traverseWebLayers(WebLayer3D._hideCursor)
    WebRenderer.hoverTargetElements.clear()
    for (const ray of rootLayer._interactionRays) {
      rootLayer._hitIntersections.length = 0
      if (ray instanceof Ray) rootLayer._raycaster.ray.copy(ray)
      else
        rootLayer._raycaster.ray.set(
          ray.getWorldPosition(scratchVector),
          ray.getWorldDirection(scratchVector2)
        )
      rootLayer._raycaster.intersectObject(rootLayer, true, rootLayer._hitIntersections)
      for (const intersection of rootLayer._hitIntersections) {
        let layer = WebLayer3D.layersByMesh.get(intersection.object as any)
        if (layer && !layer.needsRemoval) {
          layer.cursor.position.copy(intersection.point)
          layer.worldToLocal(layer.cursor.position)
          layer.cursor.visible = true
          while (layer instanceof WebLayer3DBase) {
            WebRenderer.hoverTargetElements.add(layer.element)
            layer = layer.parent as WebLayer3D
          }
          break
        }
      }
    }
  }

  static getLayerForQuery(selector: string): WebLayer3DBase | undefined {
    const element = document.querySelector(selector)!
    return WebLayer3D.layersByElement.get(element)
  }

  static getClosestLayerForElement(element: Element): WebLayer3DBase | undefined {
    const closestLayerElement =
      element && (element.closest(`[${WebLayer3D.LAYER_ATTRIBUTE}]`) as HTMLElement)
    return WebLayer3D.layersByElement.get(closestLayerElement)
  }

  hitTest(ray: THREE.Ray) {
    const raycaster = this._raycaster
    const intersections = this._hitIntersections
    const meshMap = WebLayer3D.layersByMesh
    raycaster.ray.copy(ray)
    intersections.length = 0
    raycaster.intersectObject(this, true, intersections)
    for (const intersection of intersections) {
      const layer = meshMap!.get(intersection.object as any)
      if (!layer) continue
      const layerBoundingRect = getBounds(layer.element, scratchBounds)!
      if (!layerBoundingRect.width || !layerBoundingRect.height) continue
      let target = layer.element as HTMLElement
      const clientX = intersection.uv!.x * layerBoundingRect.width
      const clientY = (1 - intersection.uv!.y) * layerBoundingRect.height
      traverseChildElements(layer.element, el => {
        if (!target.contains(el)) return false
        const elementBoundingRect = getBounds(el, scratchBounds2)!
        const offsetLeft = elementBoundingRect.left - layerBoundingRect.left
        const offsetTop = elementBoundingRect.top - layerBoundingRect.top
        const { width, height } = elementBoundingRect
        const offsetRight = offsetLeft + width
        const offsetBottom = offsetTop + height
        if (
          clientX > offsetLeft &&
          clientX < offsetRight &&
          clientY > offsetTop &&
          clientY < offsetBottom
        ) {
          target = el as HTMLElement
          return true
        }
        return false // stop traversal down this path
      })
      return { layer, intersection, target }
    }
    return undefined
  }

}

class CameraFOVs {
  top = 0
  left = 0
  bottom = 0
  right = 0
  horizontal = 0
  vertical = 0
}

const _fovs = new CameraFOVs()
const _getFovsMatrix = new Matrix4()
const _getFovsVector = new Vector3()
const FORWARD = new Vector3(0, 0, -1)
function getFovs(projectionMatrix: Matrix4) {
  const out = _fovs
  const invProjection = _getFovsMatrix.getInverse(projectionMatrix)
  const vec = _getFovsVector
  out.left = vec
    .set(-1, 0, -1)
    .applyMatrix4(invProjection)
    .angleTo(FORWARD)
  out.right = vec
    .set(1, 0, -1)
    .applyMatrix4(invProjection)
    .angleTo(FORWARD)
  out.top = vec
    .set(0, 1, -1)
    .applyMatrix4(invProjection)
    .angleTo(FORWARD)
  out.bottom = vec
    .set(0, -1, -1)
    .applyMatrix4(invProjection)
    .angleTo(FORWARD)
  out.horizontal = out.right + out.left
  out.vertical = out.top + out.bottom
  return out
}
