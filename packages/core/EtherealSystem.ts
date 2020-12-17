import { SpatialMetrics, NodeState } from './SpatialMetrics'
import { SpatialAdapter } from './SpatialAdapter'
import { Box3, MathType } from './math'
import { SpatialOptimizer, OptimizerConfig } from './SpatialOptimizer'
import { Transitionable, TransitionConfig, easing } from './Transitionable'
import { LayoutFrustum } from './LayoutFrustum'

/**
 * A third-party scenegraph node instance (e.g., THREE.Object3D)
 */
export type Node3D = { __isSceneGraphNode: true }

/**
 * Bindings for a scenegraph node instance (glue layer)
 */
export interface NodeBindings<N extends Node3D> {
    getChildren(metrics:SpatialMetrics<N>, children:Node3D[]) : void
    getState(metrics:SpatialMetrics<N>, state:NodeState<N>) : void
    getIntrinsicBounds(metrics:SpatialMetrics<N>, bounds:Box3) : void
    apply(metrics:SpatialMetrics<N>, state:Readonly<NodeState<N>>) : void
}

/**
 * Manages spatial adaptivity within an entire scene graph
 */
export class EtherealSystem<N extends Node3D = Node3D> {

    constructor(public viewNode:N, public bindings:NodeBindings<N>) { }

    config = {
        epsillonMeters: 1e-10,
        epsillonRadians: 1e-10,
        epsillonRatio: 1e-10,
        transition: new TransitionConfig({
            multiplier: 1,
            duration: 0,
            easing: easing.easeInOut,
            threshold: 0.0001,
            delay: 0,
            debounce: 0,
            maxWait: 10,
            blend: true
        }) as Required<TransitionConfig>,
        optimize: new OptimizerConfig({
            constraintThreshold: 1,
            relativeTolerance: 0.001,
            absoluteTolerance: 0.00001,
            iterationsPerFrame: 4, // iterations per frame per layout
            swarmSize: 10, // solutions per layout
            pulseFrequencyMin: 0.3, // minimal exploitation pulse
            pulseFrequencyMax: 1, // maximal exploitation pulse
            pulseRate: 0.5, // The ratio of directed exploitation vs random exploration,
            stepSizeMin: 0.01,
            stepSizeMax: 1.5,
            stepSizeStart: 0.3,
            staleRestartRate: 0.1,
            successRateMovingAverage: 200,
            successRateMin: 0.005
        }) as Required<OptimizerConfig>
    }

    /**
     * 
     */
    optimizer = new SpatialOptimizer<N>(this)

    /**
     * The view layout frustum
     */
    viewFrustum = new LayoutFrustum

    /**
     * The deltaTime for the current frame (seconds)
     * @readonly
     */
    deltaTime = 1/60

    /**
     * The time for the current frame (seconds)
     * @readonly
     */
    time = -1
    
    /**
     * The maximum delta time value
     */
    maxDeltaTime = 1/60

    /** 
     * SpatialMetrics for Node3D
     */
    nodeMetrics = new Map<N, SpatialMetrics<N>>()

    /** 
     * SpatialAdapter for Node3D
     */
    nodeAdapters = new Map<N, SpatialAdapter<N>>()

    /**
     * 
     */
    readonly transitionables = [] as Transitionable[]

    /**
     * 
     */
    get viewMetrics() {
        if (!this.viewNode) throw new Error('EtherealSystem.viewNode must be defined')
        return this.getMetrics(this.viewNode!)
    }

    /**
     * Get or create a SpatialMetrics instance which wraps a third-party node instance (e.g., THREE.Object3D instance)
     */
    getMetrics = (node:N) => {
        if (!node) throw new Error('node must be defined')
        let metrics = this.nodeMetrics.get(node) as SpatialMetrics<N>
        if (!metrics) {
            metrics = new SpatialMetrics<N>(this, node)
            this.nodeMetrics.set(node, metrics)
        }
        return metrics 
    }

    /**
     * 
     */
    getState = (node:N) => {
        if (!node) throw new Error('node must be defined')
        return this.getMetrics(node).targetState
    }

    /**
     * Get or create a SpatialAdapter instance which wraps a third-party node instance (e.g., THREE.Object3D instance)
     * @param node 
     */
    getAdapter = (node:N) => {
        let adapter = this.nodeAdapters.get(node) as SpatialAdapter<N>
        if (!adapter) {
            adapter = new SpatialAdapter(this, node)
            this.nodeAdapters.set(node, adapter)
        }
        return adapter
    }

    /**
     * Create a Transitionable instance
     */
    createTransitionable = <T extends MathType> (value:T, config?:TransitionConfig) => {
        const t = new Transitionable(this, value, config, this.config.transition)
        this.transitionables.push(t)
        return t as any as Transitionable<T>
    }

    /**
     * 
     * @param sceneNode 
     * @param viewNode 
     * @param deltaTime 
     * @param time 
     */
    update(deltaTime:number, time:number) {

        this.deltaTime = Math.max(deltaTime, this.maxDeltaTime)
        this.time = time

        for (const metrics of this.nodeMetrics.values()) {
            metrics.needsUpdate = true
            const adapter = this.nodeAdapters.get(metrics.node)
            if (adapter) {
                adapter.opacity.needsUpdate = true
                adapter.orientation.needsUpdate = true
                adapter.bounds.needsUpdate = true
            }
        }

        for (const transitionable of this.transitionables) {
            transitionable.needsUpdate = true
        }

        for (const transitionable of this.transitionables) {
            transitionable.update()
        }

        this.viewMetrics.update()
        
        for (const adapter of this.nodeAdapters.values()) {
            adapter.metrics.update()
        }

    }
}