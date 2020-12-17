import { EtherealSystem } from "@etherealjs/core/mod";
export const ThreeBindings = {
    getChildren(metrics, children) {
        const nodeObj = metrics.node;
        children.length = 0;
        for (let i = 0; i < nodeObj.children.length; i++) {
            children[i] = nodeObj.children[i];
        }
    },
    getState(metrics, state) {
        if (metrics.system.viewNode === metrics.node) {
            const cameraNode = metrics.node;
            cameraNode.updateMatrixWorld();
            metrics.system.viewFrustum.setFromPerspectiveProjectionMatrix(cameraNode.projectionMatrix);
        }
        const nodeObj = metrics.node;
        nodeObj.matrixAutoUpdate && nodeObj.updateMatrix();
        state.localMatrix = nodeObj.matrix;
        // state.opacity = (nodeObj.material as THREE.MeshBasicMaterial)?.opacity ?? 
        //                 (nodeObj.material as THREE.MeshBasicMaterial[])?.[0]?.opacity ?? 1
        // state.localOrientation = nodeObj.quaternion
        // state.localPosition = nodeObj.position
        // state.localScale = nodeObj.scale
        state.parent = nodeObj.parent;
    },
    getIntrinsicBounds(metrics, bounds) {
        const nodeObj = metrics.node;
        if (nodeObj.geometry) {
            if (!nodeObj.geometry.boundingBox)
                nodeObj.geometry.computeBoundingBox();
            return bounds.copy(nodeObj.geometry.boundingBox);
        }
        return bounds;
    },
    apply(metrics, state) {
        const node = metrics.node;
        // if (node.material) {
        //     const materialList = node.material as THREE.MeshBasicMaterial[]
        //     if (materialList.length) materialList[0].opacity = state.opacity
        //     else (node.material as THREE.MeshBasicMaterial).opacity = state.opacity
        // }
        if (state.parent !== node.parent) {
            const newParent = state.parent;
            newParent.add(node);
        }
        node.quaternion.copy(state.localOrientation);
        node.position.copy(state.localPosition);
        node.scale.copy(state.localScale);
        node.matrix.copy(state.localMatrix);
        node.matrixWorld.copy(state.worldMatrix);
        // node.matrixAutoUpdate = true
        // node.matrixWorldNeedsUpdate = true
    }
};
export const DefaultBindings = {
    getChildren(metrics, children) {
        if (metrics.node.isObject3D) {
            ThreeBindings.getChildren(metrics, children);
        }
    },
    getState(metrics, state) {
        if (metrics.node.isObject3D) {
            ThreeBindings.getState(metrics, state);
        }
    },
    getIntrinsicBounds(metrics, bounds) {
        if (metrics.node.isObject3D) {
            ThreeBindings.getIntrinsicBounds(metrics, bounds);
        }
        return bounds;
    },
    apply(metrics, state) {
        if (metrics.node.isObject3D) {
            ThreeBindings.apply(metrics, state);
        }
    }
};
export function createSystem(viewNode, bindings = DefaultBindings) {
    return new EtherealSystem(viewNode, bindings);
}
export * from '@etherealjs/core/mod';
export { WebLayer3D, WebLayer3DBase, WebRenderer } from '@etherealjs/web-layer/mod';
// import {WebLayer3D,WebLayer3DOptions} from '@etherealjs/web-layer/mod'
// export class AdaptiveWebLayer extends WebLayer3D {
//     constructor(elementOrHTML:Element|string, options:WebLayer3DOptions) {
//         super(elementOrHTML, options)
//         const oLC = options.onLayerCreate
//         options.onLayerCreate = (layer) => {
//             oLC?.(layer)
//         }
//     }
// }
