
import { Box3, Vector3, Quaternion, Matrix4, V_000, DIRECTION, V_111 } from './math'
import { EtherealSystem, Node3D } from './EtherealSystem'
import { LayoutFrustum } from './LayoutFrustum'
import { MemoizationCache } from './MemoizationCache'

const InternalCurrentState = Symbol("current")
const InternalTargetState = Symbol("target")

export class NodeState<N extends Node3D=Node3D> {

    constructor(public mode:'current'|'target', public metrics:SpatialMetrics<N>) {}
    
    private _cache = new MemoizationCache

    invalidate() {
        this._cache.invalidateAll()
    }
 
    get parent() {
        return this._parent
    }
    set parent(val:N|null) {
        const current = this._parent
        if (current !== val) {
            this._parent = val
            this.invalidate()
        }
    }
    private _parent : N|null = null

    get parentState() {
        const parentMetrics = this.parent && this.metrics.system.getMetrics(this.parent)
        return this.mode === 'current' ? parentMetrics?.currentState : parentMetrics?.targetState
    }

    get outerState() {
        const outerMetrics = this.metrics.outerMetrics
        return this.mode === 'current' ? outerMetrics?.currentState : outerMetrics?.targetState
    }

    private _cachedLocalMatrix = this._cache.memoize(() => {
        this._localMatrix.decompose(this._localPosition, this._localOrientation, this._localScale)
        this._localOrientationInverse.copy(this._localOrientation).inverse()
        this._localRotation.makeRotationFromQuaternion(this._localOrientation)
        this._localRotationInverse.makeRotationFromQuaternion(this._localOrientationInverse)
        return this._localMatrix
    })
    get localMatrix() { return this._localMatrix }
    set localMatrix(val:Matrix4) {
        if (!this._localMatrix.equals(val)) {
            this.invalidate()
            this._localMatrix.copy(val)
            this._localMatrixInverse.getInverse(this._localMatrix)
        }
    }

    private _localMatrix = new Matrix4
    private _localMatrixInverse = new Matrix4
    private _localPosition = new Vector3
    private _localOrientation = new Quaternion
    private _localOrientationInverse = new Quaternion
    private _localScale = new Vector3(1,1,1)
    private _localRotation = new Matrix4
    private _localRotationInverse = new Matrix4

    get localMatrixInverse() {
        return this._localMatrixInverse
    }

    get localPosition() {
        this._cachedLocalMatrix()
        return this._localPosition
    }

    get localOrientation() {
        this._cachedLocalMatrix()
        return this._localOrientation
    }

    get localOrientationInverse() {
        this._cachedLocalMatrix()
        return this._localOrientationInverse
    }

    get localScale() {
        this._cachedLocalMatrix()
        return this._localScale
    }

    /**
     * Local rotation matrix
     */
    get localRotation() {
        this._cachedLocalMatrix()
        return this._localRotation
    }

    /**
     * Local Orientation matrix inverse
     */
    get localRotationInverse() {
        this._cachedLocalMatrix()
        return this._localRotationInverse
    }

    private _cachedWorldMatrix = this._cache.memoize(() => {
        const matrix = this._worldMatrix.copy(this.localMatrix)
        const parentState = this.parentState
        if (parentState) {
            matrix.premultiply(parentState.worldMatrix)
        }
        matrix.decompose(this._worldPosition, this._worldOrientation, this._worldScale)
        this._worldMatrixInverse.getInverse(this._worldMatrix)
        this._worldOrientationInverse.copy(this._worldOrientation).inverse()
        this._worldRotation.makeRotationFromQuaternion(this._worldOrientation)
        this._worldRotationInverse.makeRotationFromQuaternion(this._worldOrientationInverse)
        return matrix
    })
    get worldMatrix() {
        return this._cachedWorldMatrix()
    }
    
    private _worldPosition = new Vector3
    private _worldOrientation = new Quaternion
    private _worldOrientationInverse = new Quaternion
    private _worldScale = new Vector3
    private _worldMatrix = new Matrix4
    private _worldMatrixInverse = new Matrix4
    private _worldRotation = new Matrix4
    private _worldRotationInverse = new Matrix4

    get worldMatrixInverse() {
        this.worldMatrix
        return this._worldMatrixInverse
    }

    get worldPosition() {
        this.worldMatrix
        return this._worldPosition
    }

    get worldOrientation() {
        this.worldMatrix
        return this._worldOrientation
    }

    get worldScale() {
        this.worldMatrix
        return this._worldScale
    }

    /**
     * Inverse world orientation
     */
    get worldOrientationInverse() {
        return this._worldOrientationInverse
    }

    /**
     * World rotation matrix
     */
    get worldRotation() {
        return this._worldRotation
    }
    
    /**
     * World rotation matrix inverse
     */
    get worldRotationInverse() {
        return this._worldRotationInverse
    }

    /**
     * The inner bounds center in world coordinates
     */
    private _cachedWorldCenter = this._cache.memoize(() => {
        return this._worldCenter.copy(this.metrics.innerCenter).applyMatrix4(this.worldMatrix)
    })
    get worldCenter() {
        return this._cachedWorldCenter()
    }
    private _worldCenter = new Vector3

    /**
     * The outer origin in world coordinates
     */
    // private _cachedWorldOrigin = this._cache.memoize(() => {
    //     const outerState = this.outerState
    //     const origin = this.metrics.system.nodeAdapters.get(this.metrics.node)?.origin?.[this.mode]
    //     if (!origin || !outerState) return outerState?.worldCenter ?? V_000
    //     return this._worldOrigin.copy(outerState.metrics.innerSize ?? V_000)
    //         .multiply(origin).add(outerState.metrics.innerBounds.min ?? V_000).applyMatrix4( outerState.worldMatrix )
    // })
    get worldOrigin() {
        return this.outerState?.worldCenter ?? V_000
        // return this._cachedWorldOrigin()
    }
    // private _worldOrigin = new Vector3

    /**
     * The layout space (convert to world space from layout space)
     */
    private _cachedLayoutMatrix = this._cache.memoize(() => {
        const layoutMatrix = this._layoutMatrix.compose(this.worldOrigin, this.worldOrientation, V_111) 
        this._layoutMatrixInverse.getInverse(this._layoutMatrix)
        this._localFromLayout.multiplyMatrices(this.worldMatrixInverse, layoutMatrix)
        this._layoutFromLocal.getInverse(this._localFromLayout)
        return layoutMatrix
    })
    get layoutMatrix() {
        return this._cachedLayoutMatrix()
    }

    private _layoutMatrix = new Matrix4
    private _layoutMatrixInverse = new Matrix4
    private _localFromLayout = new Matrix4
    private _layoutFromLocal = new Matrix4


    /**
     * Convert to layout space from world space
     */
    get layoutMatrixInverse() {
        this.layoutMatrix
        return this._layoutMatrixInverse
    }

    /**
     * Convert to local space from layout space
     */
    get localFromLayout() { 
        this.layoutMatrix
        return this._localFromLayout
    }

    /**
     * Convert to layout space from local space
     */
    get layoutFromLocal() { 
        this.layoutMatrix
        return this._layoutFromLocal 
    }

    // // /**
    // //  * Convert to layout space from parent space
    // //  */
    // get layoutFromParent() {
    //     return this._layoutFromParent.multiplyMatrices(this.layoutFromLocal, this.localMatrixInverse)
    // }
    // private _layoutFromParent = new Matrix4


    // // /**
    // //  * Convert to parent space from layout space
    // //  */
    // get parentFromLayout() {
    //     return this._parentFromLayout.getInverse(this.layoutFromParent)
    // }
    // private _parentFromLayout = new Matrix4
    
    /**
     * The layout bounds 
     */
    private _cachedLayoutBounds = this._cache.memoize(() => {
        if (this.metrics.innerBounds.isEmpty()) {
            this._layoutBounds.setFromCenterAndSize(V_000,V_111)
        } else {
            this._layoutBounds.copy(this.metrics.innerBounds)
        }
        const bounds = this._layoutBounds.applyMatrix4(this.layoutFromLocal)
        bounds.getCenter(this._layoutCenter)
        bounds.getSize(this._layoutSize)
        return bounds
    })
    get layoutBounds() { return this._cachedLayoutBounds() }
    private _layoutBounds = new Box3
    private _layoutSize = new Vector3
    private _layoutCenter = new Vector3

    /**
     * The layout size
     */
    get layoutSize() {
        this.layoutBounds
        return this._layoutSize
    }

    /**
     * The layout center
     */
    get layoutCenter() {
        this.layoutBounds
        return this._layoutCenter
    }

    /**
     * The first non-empty parent bounds, reoriented
     */
    private _cachedOuterBounds = this._cache.memoize(() => {
        const bounds = this._outerBounds
        const outerState = this.outerState
        if (!outerState || outerState.metrics.innerBounds.isEmpty()) {
            bounds.makeEmpty()
        } else {
            bounds.copy(outerState.metrics.innerBounds)
            const layoutFromOuter = this._layoutFromOuter.multiplyMatrices( 
                this.layoutMatrixInverse, 
                outerState.worldMatrix 
            )
            bounds.applyMatrix4(layoutFromOuter)
        }
        bounds.getCenter(this._outerCenter)
        bounds.getSize(this._outerSize)
        return bounds
    })
    get outerBounds() { return this._cachedOuterBounds() }
    private _outerBounds = new Box3
    private _outerCenter = new Vector3
    private _outerSize = new Vector3
    private _layoutFromOuter = new Matrix4

    /**
     * 
     */
    get outerCenter() {
        this.outerBounds
        return this._outerCenter
    }

    // /**
    //  * 
    //  */
    get outerSize() {
        this.outerBounds
        return this._outerSize
    }

    // /**
    //  * The layout bounds in proportional units ( identity with parent layout is center=[0,0,0] size=[1,1,1] )
    //  */
    // @cached get proportionalBounds() {
    //     const proportional = this._proportionalBounds.copy(this.layoutBounds)
    //     const outerSize = this.outerSize
    //     proportional.min.divide(outerSize)
    //     proportional.max.divide(outerSize)
    //     proportional.getCenter(this._proportionalCenter)
    //     proportional.getSize(this._proportionalSize)
    //     return proportional
    // }
    // private _proportionalBounds = new Box3
    // private _proportionalCenter = new Vector3
    // private _proportionalSize = new Vector3

    // /**
    //  * Proportional size ( identity with parent layout is size=[1,1,1] )
    //  */
    // get proportionalSize() {
    //     this.proportionalBounds
    //     return this._proportionalSize
    // }

    // /**
    //  * 
    //  */
    // get proportionalCenter() {
    //     this.proportionalBounds
    //     return this._proportionalCenter
    // }

    private get _viewState() : NodeState<N> {
        if (this.metrics.system.viewNode === this.metrics.node) return this
        const viewMetrics = this.metrics.system.viewMetrics
        return (this.mode === 'current' ? 
            viewMetrics[InternalCurrentState] : 
            viewMetrics[InternalTargetState]) as NodeState<N>
    }


    /**
     * The view space from local space
     */
    get viewFromLocal() {
        return this._viewFromLocal.multiplyMatrices(this._viewState.worldMatrixInverse, this.worldMatrix)
    }
    private _viewFromLocal = new Matrix4
    
    /**
     * The view space from layout space
     */
    get viewFromLayout() {
        return this._viewFromLayout.multiplyMatrices(this._viewState.worldMatrixInverse, this.layoutMatrix)
    }
    private _viewFromLayout = new Matrix4

    /**
     * Convert to parent space from layout space
     */
    get layoutFromView() {
        return this._layoutFromView.getInverse(this.viewFromLayout)
    }
    private _layoutFromView = new Matrix4

    /**
     * The view projection space from layout space
     */
    // @cached get viewProjectionFromLocal() {
    //     return this._viewProjectionFromLayout.multiplyMatrices(this.viewFromLocal, perspective)
    // }
    // private _viewProjectionFromLayout = new Matrix4


    get screenBounds() {
        return this._cachedScreenBounds()
    }
    private _cachedScreenBounds = this._cache.memoize(() => {
        if (this.metrics.system.viewNode === this.metrics.node) {
            this._screenBounds.min.setScalar(-1)
            this._screenBounds.max.setScalar(1)
            return this._screenBounds
        }
        const viewFrustum = this.metrics.system.viewFrustum
        const projection = viewFrustum.perspectiveProjectionMatrix
        const viewFromLocal = this.viewFromLocal
        const viewProjectionFromLocal = this._viewProjectionFromLocal.multiplyMatrices(projection, viewFromLocal)
        const bounds = this._screenBounds.copy(this.metrics.innerBounds).applyMatrix4(viewProjectionFromLocal)
        // measure as slightly smaller than actual to hide gaps at edges
        bounds.min.x *= 0.999
        bounds.max.x *= 0.999
        bounds.min.y *= 0.999
        bounds.max.y *= 0.999
        bounds.getCenter(this._screenCenter)
        bounds.getSize(this._screenSize) 
        return bounds
    }, this._viewState._cache)
    private _viewProjectionFromLocal = new Matrix4
    private _screenBounds = new Box3
    private _screenCenter = new Vector3
    private _screenSize = new Vector3

    get screenCenter() {
        this._cachedScreenBounds()
        return this._screenCenter
    }
    get screenSize() {
        this._cachedScreenBounds()
        return this._screenSize
    }

    /**
     * The visual bounds of the this node.
     * X and Y coordinates are in degrees, with the origin being centered in the visual space
     * Z coordinate are in meters
     */
    get visualFrustum() {
        return this._cachedVisualFrustum()
    }
    private _cachedVisualFrustum = this._cache.memoize(() => {
        if (this.metrics.node === this.metrics.system.viewNode) {
            return this.metrics.system.viewFrustum
        }
        const projection = this.metrics.system.viewFrustum.perspectiveProjectionMatrix
        return this._visualFrustum.setFromPerspectiveProjectionMatrix(projection, this.screenBounds)
    }, this._viewState._cache)
    private _visualFrustum  = new LayoutFrustum

    /**
     * The view position relative to this node state
     */
    get relativeViewPosition() {
        return this._viewPosition.copy(this._viewState.worldPosition).applyMatrix4(this.worldMatrixInverse)
    }
    private _viewPosition = new Vector3


    /**
     * The local orthogonal (right-angled) orientation with the closest view orientation alignment
     */
    get viewAlignedOrientation() {
        return this._cachedViewAlignedOrientation()
    }
    private _cachedViewAlignedOrientation = this._cache.memoize(() => {
        const relativeViewMatrix = this._relativeViewMatrix.multiplyMatrices(this.worldMatrixInverse, this._viewState.worldMatrix)
        const relativeViewRotation = this._relativeViewRotation.extractRotation(relativeViewMatrix)
        const relativeViewOrientation = this._relativeViewOrientation.setFromRotationMatrix(relativeViewRotation)
        const forwardDirection = this._relativeViewForward.set(0, 0, 1).applyQuaternion(relativeViewOrientation)
        const upDirection = this._relativeViewUp.set(0, 1, 0).applyQuaternion(relativeViewOrientation)
        
        let distForward = Infinity
        let distUp = Infinity
        let closestForwardDirection : Vector3
        let closestUpDirection : Vector3
        let d : keyof typeof DIRECTION

        for (d in DIRECTION) {
            const dir = DIRECTION[d]
            var dist = upDirection.distanceToSquared(dir)
            if (dist < distUp) {
                distUp = dist
                closestUpDirection = dir
            }
        }
    
        for (d in DIRECTION) {
            const dir = DIRECTION[d]    
            // avoid having forward & up defined on the same axis
            if (dir.x && closestUpDirection!.x) continue
            if (dir.y && closestUpDirection!.y) continue
            if (dir.z && closestUpDirection!.z) continue
            const dist = forwardDirection.distanceToSquared(dir)
            if (dist < distForward) {
                distForward = dist
                closestForwardDirection = dir
            }
        }
    
        const rot = this._orthogonalRotation.identity()
        rot.lookAt(closestForwardDirection!, V_000, closestUpDirection!)
        return this._orthogonalOrientation.setFromRotationMatrix(rot)
    }, this._viewState._cache)
    private _relativeViewMatrix = new Matrix4
    private _relativeViewRotation = new Matrix4
    private _relativeViewOrientation = new Quaternion
    private _relativeViewUp = new Vector3
    private _relativeViewForward = new Vector3
    private _orthogonalRotation = new Matrix4
    private _orthogonalOrientation = new Quaternion


    // screenBounds() {
    //     const screenBounds = this._screenBounds
    //     this.metrics.innerBounds.min.project
    //     var pos = object.position.clone()
    //     camera.updateMatrixWorld()
    //     pos.project(camera)
    //     return screenBounds.set(pos.x, pos.y)
    // }
    // private _screenBounds = new Box2

    private _computeOcclusion = this._cache.memoize(() => {
        this._occludingPercent = 0
        this._occludedPercent = 0
        
        const metrics = this.metrics
        if (metrics.innerBounds.isEmpty()) return
        
        const system = metrics.system
        const adapters = system.nodeAdapters.values()

        const myFrustum = this.visualFrustum
        const myNear = myFrustum.nearMeters

        for (const adapter of adapters) {
            const otherMetrics = adapter.metrics
            if (otherMetrics === metrics) continue
            if (!otherMetrics.isAdaptive || otherMetrics.innerBounds.isEmpty()) continue
            if (otherMetrics.containedByNode(adapter.node)) continue
            
            const otherState = this.mode === 'current' ? otherMetrics.currentState : otherMetrics.targetState
            const otherFrustum = otherState.visualFrustum
            const overlapPercent = myFrustum.overlapPercent(otherFrustum)

            if (overlapPercent > 0)  {
                if  (myNear < otherFrustum.nearMeters) this._occludingPercent += overlapPercent
                else this._occludedPercent += overlapPercent
            }
        }
    },  this._viewState._cache)

    /** 
     * The percent of this node occluding another node
     */
    get occludingPercent() {
        this._computeOcclusion()
        return this._occludingPercent
    }
    private _occludingPercent = 0

    /**
     * The percent of this node occluded by another node
     */
    get occludedPercent() {
        this._computeOcclusion()
        return this._occludedPercent
    }
    private _occludedPercent = 0

}


/**
 * Maintains current & target scenegraph state,
 * and efficiently/reactively compute spatial metrics 
 * based on *target* (not current) scenegraph state. 
 * 
 * All metric values should be treated as read-only.
 */
export class SpatialMetrics<N extends Node3D=Node3D> {
    
    constructor(public system:EtherealSystem<N>, public node:N) {}

    private _cache = new MemoizationCache()
    
    needsUpdate = true

    /**
     * Update metrics, if necessary
     */
    update() {
        if (this.needsUpdate) {
            this.needsUpdate = false
            const parent = this.nodeState.parent
            const parentMetrics = parent && this.system.getMetrics(parent)
            parentMetrics?.update()
            
            const adapter = this.system.nodeAdapters.get(this.node)

            if (adapter) {

                adapter._update()

            } else {
                this.invalidateInnerBounds()
                this.invalidateNodeStates()
            }

        }
    }
    
    private _cachedInnerBounds = this._cache.memoize(() => {
        const inner = this._innerBounds

        if (this.node !== this.system.viewNode && this.parentNode) {
            inner.copy(this.intrinsicBounds)
            const childBounds = this._childBounds
            for (const c of this.boundsChildren) {
                const childMetrics = this.system.getMetrics(c)
                childBounds.copy(childMetrics.innerBounds)
                childBounds.applyMatrix4(childMetrics.nodeState.localMatrix)
                inner.union(childBounds)
            }
        }

        const center = inner.getCenter(this._innerCenter)
        const size = inner.getSize(this._innerSize)
        if (size.length() > 0) {
            const sizeEpsillon = this.system.config.epsillonMeters
            if (Math.abs(size.x) <= sizeEpsillon) size.x = (Math.sign(size.x) || 1) * sizeEpsillon * 10
            if (Math.abs(size.y) <= sizeEpsillon) size.y = (Math.sign(size.y) || 1) * sizeEpsillon * 10
            if (Math.abs(size.z) <= sizeEpsillon) size.z = (Math.sign(size.z) || 1) * sizeEpsillon * 10
            inner.setFromCenterAndSize(center, size)
        }
        return inner
    })
    private _childBounds = new Box3
    private _innerBounds = new Box3
    private _innerCenter = new Vector3
    private _innerSize = new Vector3

    /**
     * The bounds of this node and non-adaptive child nodes in the local coordinate system
     */
    get innerBounds() {
        return this._cachedInnerBounds()
        // return this._innerBounds
    }
    
    get innerCenter() {
        this.innerBounds
        return this._innerCenter
    }

    get innerSize() {
        this.innerBounds
        return this._innerSize
    }

    /**
     * The intrinsic bounds of the geometry attached directly to this node (excluding child nodes)
     */
    get intrinsicBounds() : Readonly<Box3> {
        if (this._intrinsicBoundsNeedsUpdate) {
            this._intrinsicBoundsNeedsUpdate = false
            this.system.bindings.getIntrinsicBounds(this, this._intrinsicBounds)
            this._intrinsicBounds.getCenter(this._intrinsicCenter)
            this._intrinsicBounds.getSize(this._intrinsicSize)
        }
        return this._intrinsicBounds
    }

    private _intrinsicBoundsNeedsUpdate = true
    private _intrinsicBounds = new Box3
    private _intrinsicCenter = new Vector3
    private _intrinsicSize = new Vector3
    
    get intrinsicCenter() {
        this.intrinsicBounds
        return this._intrinsicCenter
    }

    get intrinsicSize() {
        this.intrinsicBounds
        return this._intrinsicSize
    }

    /**
     * Invalidate intrinsic bounds in order to allow it to be recomputed
     */
    invalidateIntrinsicBounds() {
        this._intrinsicBoundsNeedsUpdate = true
        for (const c of this.boundsChildren) {
            const childMetrics = this.system.getMetrics(c)
            childMetrics.invalidateIntrinsicBounds()
        }
    }

    invalidateInnerBounds() {
        if (this._cachedInnerBounds.needsUpdate) return
        this._cachedNodeChildren.needsUpdate = true
        this._cachedBoundsChildren.needsUpdate = true
        this._cachedInnerBounds.needsUpdate = true
        for (const c of this.boundsChildren) {
            const childMetrics = this.system.getMetrics(c)
            childMetrics.invalidateInnerBounds()
        }
    }

    /**
     * Returns false if this node does not contain the passed node.
     * If the given node is a descendent of this node, returns
     * the closest child node.
     */
    containsNode(node:N) {
        this.update()
        let parentMetrics = this.system.getMetrics(node) as SpatialMetrics<N>|null
        while (parentMetrics) {
            if (parentMetrics.parentMetrics === this) return parentMetrics.node
            parentMetrics = parentMetrics.parentMetrics
        }
        return false
    }

    containedByNode(node:N) {
        this.update()
        let parentMetrics = this.parentMetrics
        while (parentMetrics) {
            if (parentMetrics.node === node) return parentMetrics.node
            parentMetrics = parentMetrics.parentMetrics
        }
        return false
    }

    /**
     * 
     */
    get nodeChildren() {
        return this._cachedNodeChildren()
    }
    private _cachedNodeChildren = this._cache.memoize(() => {
        this.system.bindings.getChildren(this, this._nodeChildren)
        return this._nodeChildren
    })
    private _nodeChildren = new Array<N>()

    /**
     * Get the local node state (only local state is defined)
     */
    get nodeState() : Readonly<NodeState<N>> {
        if (!this._nodeState) this._nodeState = new NodeState('target', this)
        return this._cachedNodeState()
    }
    private _cachedNodeState = this._cache.memoize(() => {
        this.system.bindings.getState(this, this._nodeState)
        return this._nodeState
    })
    private _nodeState!:NodeState<N>

    /**
     * Compute spatial state from layout orientation & bounds
     */
    private _computeState = (() => {

        const localMatrix = new Matrix4
        const localOrientation = new Quaternion
        const localPosition = new Vector3
        const localScale = new Vector3

        const worldMatrix = new Matrix4
        const worldPosition = new Vector3
        const worldOrientation = new Quaternion
        const worldScale = new Vector3

        const layoutCenter = new Vector3
        const layoutSize = new Vector3
        const layoutOffset = new Vector3
        const innerOffset = new Vector3

        return function computeState(this:SpatialMetrics<N>, state:NodeState<N>) {

            const useCurrent = state.mode === 'current'
            const adapter = this.system.nodeAdapters.get(this.node)

            localOrientation.copy( 
                ( useCurrent ? 
                    adapter?.orientation.active && adapter?.orientation.current :
                    adapter?.orientation.active && adapter?.orientation.target
                ) || this.nodeState.localOrientation
            )
                
            const layoutBounds = (useCurrent ? 
                adapter?.bounds.active && adapter?.bounds.current :
                adapter?.bounds.active && adapter?.bounds.target)

            const parentMetrics = this.parentMetrics
            state.parent = parentMetrics?.node ?? null

            if (layoutBounds) {
                layoutBounds.getCenter(layoutCenter)
                layoutBounds.getSize(layoutSize)

                const parentState = useCurrent ? 
                    parentMetrics?.currentState : 
                    parentMetrics?.targetState

                const innerCenter = this.innerCenter
                const innerSize = this.innerSize

                const sizeEpsillon = this.system.config.epsillonMeters
                if (Math.abs(layoutSize.x) <= sizeEpsillon) layoutSize.x = (Math.sign(layoutSize.x) || 1) * sizeEpsillon * 10
                if (Math.abs(layoutSize.y) <= sizeEpsillon) layoutSize.y = (Math.sign(layoutSize.y) || 1) * sizeEpsillon * 10
                if (Math.abs(layoutSize.z) <= sizeEpsillon) layoutSize.z = (Math.sign(layoutSize.z) || 1) * sizeEpsillon * 10

                worldScale.copy(layoutSize)
                if (Math.abs(innerSize.x) >= sizeEpsillon) worldScale.x /= innerSize.x
                if (Math.abs(innerSize.y) >= sizeEpsillon) worldScale.y /= innerSize.y
                if (Math.abs(innerSize.z) >= sizeEpsillon) worldScale.z /= innerSize.z

                parentState ?
                    worldOrientation.multiplyQuaternions(parentState.worldOrientation, localOrientation) :
                    worldOrientation.copy(localOrientation)
                
                layoutOffset.copy(layoutCenter).applyQuaternion(worldOrientation)
                innerOffset.copy(innerCenter).multiply(worldScale).applyQuaternion(worldOrientation)
                worldPosition.copy(state.worldOrigin).add(layoutOffset).sub(innerOffset)
                
                worldMatrix.compose(worldPosition,worldOrientation,worldScale)

                parentState ?    
                    localMatrix.multiplyMatrices(parentState.worldMatrixInverse, worldMatrix) :
                    localMatrix.copy(worldMatrix)

            } else {

                localPosition.copy(this.nodeState.localPosition)
                localScale.copy(this.nodeState.localScale)
                localMatrix.compose(localPosition, localOrientation, localScale)
                
            }

            // apply changes
            state.localMatrix = localMatrix
            return state
        }
    })()

    invalidateNodeStates() {
        this._cachedNodeState.needsUpdate = true
        this._nodeState.invalidate()
        this._cachedCurrentState.needsUpdate = true
        this._cachedTargetState.needsUpdate = true
        this[InternalCurrentState].invalidate()
        this[InternalTargetState].invalidate()
    }

    /**
     * The current state
     */
    get currentState() : Readonly<NodeState<N>> {
        this.update()
        return this._cachedCurrentState()
    }
    private _cachedCurrentState = this._cache.memoize(() => {
        return this._computeState(this[InternalCurrentState])
    });
    [InternalCurrentState]:NodeState<N> = new NodeState('current', this)

    /**
     * The target state
     */
    get targetState() : Readonly<NodeState<N>> {
        this.update()
        return this._cachedTargetState()
    }
    private _cachedTargetState = this._cache.memoize(() => {
        return this._computeState(this[InternalTargetState])
    });
    [InternalTargetState]:NodeState<N> = new NodeState('target', this)

    /** 
     * The parent node
     */
    get parentNode() : N|null {
        this.update()
        const adapter = this.system.nodeAdapters.get(this.node)
        return adapter?.parentNode === undefined ? 
            this.nodeState.parent : adapter.parentNode
    }
    
    /**
     * The parent metrics
     */
    get parentMetrics() {
        const parent = this.parentNode
        if (!parent) return null
        return this.system.getMetrics(parent)
    }

    /**
     * The closest non-empty containing metrics
     */
    get outerMetrics() {
        let parentMetrics = this.parentMetrics
        while (parentMetrics && (parentMetrics.innerBounds.isEmpty())) {
            parentMetrics = parentMetrics.parentMetrics
        }
        return parentMetrics
    }

    /**
     * The child nodes that are included in this bounding context
     */
    get boundsChildren() : ReadonlyArray<N> {
        return this._cachedBoundsChildren()
    }
    private _cachedBoundsChildren = this._cache.memoize(() => {
        const nodeChildren = this.nodeChildren
        const children = this._children
        children.length = 0
        for (const child of nodeChildren) {
            const metrics = this.system.getMetrics(child)
            if (metrics.isAdaptive) continue
            children.push(child)
        }
        return children
    })
    private _children = [] as N[]

    /**
     * 
     */
    get isAdaptive() {
        return this.system.nodeAdapters.has(this.node)
    }
    
}

