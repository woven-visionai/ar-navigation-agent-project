// VRM Avatar Implementation - V3 Improved with Natural Motion
// Separated JavaScript module for VRM avatar functionality

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from 'https://unpkg.com/@pixiv/three-vrm@2.0.6/lib/three-vrm.module.js';

export class VRMAvatar {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.vrm = null;
        this.clock = new THREE.Clock();
        
        // Mouse tracking
        this.mouseX = 0;
        this.mouseY = 0;
        
        // Bone references
        this.headBone = null;
        this.neckBone = null;
        this.spinalBones = {};
        
        // Animation settings
        this.breathingIntensity = 0.035;  // Reduced from 0.06, moderate breathing
        this.swayIntensity = 0.025;       // Reduced from 0.04, subtle sway
        this.breathingSpeed = 1.1;        // Natural breathing rhythm
        this.swaySpeed = 0.7;             // Gentle sway speed
    }

    initScene(containerId = 'vrm-container') {        
        this.scene = new THREE.Scene();
        
        this.camera = new THREE.PerspectiveCamera(40, 200/480, 0.1, 100);
        this.camera.position.set(0, 0.4, 2.2);
        
        this.renderer = new THREE.WebGLRenderer({ 
            alpha: true, 
            antialias: true,
            powerPreference: "high-performance",
            precision: "highp"
        });
        this.renderer.setSize(200, 480);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 0);
        
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.shadowMap.autoUpdate = true;
        
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        
        this.renderer.physicallyCorrectLights = true;
        this.renderer.gammaFactor = 2.2;
        
        const container = document.getElementById(containerId);
        if (container) {
            container.appendChild(this.renderer.domElement);
            console.log('Renderer added to container');
        } else {
            console.error('VRM container not found');
            return false;
        }
        
        this.setupLighting();
        return true;
    }

    setupLighting() {
        console.log('Setting up professional avatar lighting with shadows...');
        
        const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
        keyLight.position.set(2, 4, 3);
        keyLight.castShadow = true;
        
        keyLight.shadow.mapSize.width = 2048;
        keyLight.shadow.mapSize.height = 2048;
        keyLight.shadow.camera.near = 0.1;
        keyLight.shadow.camera.far = 20;
        keyLight.shadow.camera.left = -2;
        keyLight.shadow.camera.right = 2;
        keyLight.shadow.camera.top = 2;
        keyLight.shadow.camera.bottom = -2;
        keyLight.shadow.bias = -0.0005;
        keyLight.shadow.normalBias = 0.02;
        keyLight.shadow.radius = 8;
        this.scene.add(keyLight);
        
        // Fill light - Softer light from opposite side to reduce harsh shadows
        const fillLight = new THREE.DirectionalLight(0xfff8e1, 0.6);
        fillLight.position.set(-3, 2, 2);
        fillLight.castShadow = false; // Fill light doesn't need shadows
        this.scene.add(fillLight);
        
        // Rim/Back light - Creates nice edge lighting on avatar
        const rimLight = new THREE.DirectionalLight(0xe8f4ff, 0.8);
        rimLight.position.set(-1, 3, -2);
        rimLight.castShadow = false;
        this.scene.add(rimLight);
        
        // Ambient light - Soft overall illumination
        const ambientLight = new THREE.AmbientLight(0x404556, 0.4);
        this.scene.add(ambientLight);
        
        // Bottom/ground bounce light - Simulates light bouncing from ground
        const groundLight = new THREE.DirectionalLight(0xffffff, 0.3);
        groundLight.position.set(0, -2, 1);
        groundLight.castShadow = false;
        this.scene.add(groundLight);
        
        // Add invisible ground plane for shadow catching
        this.addShadowPlane();
        
        // Store original intensities for dynamic adjustment
        this.storeLightIntensities();
    }

    // Add invisible shadow-catching plane
    addShadowPlane() {
        const planeGeometry = new THREE.PlaneGeometry(4, 4);
        const planeMaterial = new THREE.ShadowMaterial({ 
            opacity: 0.3,
            transparent: true 
        });
        
        const shadowPlane = new THREE.Mesh(planeGeometry, planeMaterial);
        shadowPlane.rotation.x = -Math.PI / 2;
        shadowPlane.position.y = -2;
        shadowPlane.receiveShadow = true;
        
        this.scene.add(shadowPlane);
        console.log('Shadow-catching plane added');
    }

    // Enable shadows on VRM model
    enableShadowsOnVRM(scene) {
        console.log('Enabling shadows on VRM model...');
        let meshCount = 0;
        
        scene.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                meshCount++;
                
                // Enhance material properties for better lighting
                if (child.material) {
                    // Ensure materials work well with shadows
                    if (child.material.transparent) {
                        child.material.alphaTest = 0.1; // Prevent shadow issues with transparent materials
                    }
                    
                    // Enable envMap if available for better reflections
                    if (child.material.envMap) {
                        child.material.envMapIntensity = 0.3;
                    }
                }
            }
        });
        
        console.log(`Shadows enabled on ${meshCount} meshes in VRM model`);
    }

    // Load VRM model with proper VRM support
    async loadVRM(vrmPath = './Mahotsukai-jk.vrm') {
        try {
            console.log('Loading VRM model with anatomical pose support...');
            const loader = new GLTFLoader();
            
            // Register VRM plugin
            loader.register((parser) => {
                return new VRMLoaderPlugin(parser);
            });
            
            const gltf = await loader.loadAsync(vrmPath);
            console.log('GLTF loaded:', gltf);
            
            // Get VRM instance
            this.vrm = gltf.userData.vrm;
            
            if (this.vrm) {
                // Add VRM model - positioned and rotated
                this.scene.add(this.vrm.scene);
                this.vrm.scene.position.set(0, -1.3, 0);
                this.vrm.scene.rotation.y = Math.PI - 0.15; // Face forward - VRoid coordinate system check
                this.vrm.scene.scale.set(1, 1, 1);
                
                // Enable shadows on VRM model
                this.enableShadowsOnVRM(this.vrm.scene);
                
                console.log('VRM model loaded successfully');
                console.log('VRM lookAt available:', !!this.vrm.lookAt);
                console.log('VRM humanoid available:', !!this.vrm.humanoid);
                
                this.setupBones();
                await this.applyVRoidPose(this.currentPosePath || './pose.vroidpose');
                
            } else {
                console.warn('No VRM data found, loading as regular GLTF');
                this.createFallbackVRM(gltf);
            }
            
        } catch (error) {
            console.error('Error loading VRM model:', error);
            this.createFallbackCube();
        }
    }

    // Setup bone references
    setupBones() {
        if (this.vrm.humanoid) {
            this.headBone = this.vrm.humanoid.getNormalizedBoneNode('head');
            this.neckBone = this.vrm.humanoid.getNormalizedBoneNode('neck');
            
            // Get spinal bones for natural swaying motion
            this.spinalBones.hips = this.vrm.humanoid.getNormalizedBoneNode('hips');
            this.spinalBones.spine = this.vrm.humanoid.getNormalizedBoneNode('spine');
            this.spinalBones.chest = this.vrm.humanoid.getNormalizedBoneNode('chest');
            this.spinalBones.upperChest = this.vrm.humanoid.getNormalizedBoneNode('upperChest');
            
            console.log('Head bone found:', !!this.headBone);
            console.log('Neck bone found:', !!this.neckBone);
            console.log('Spinal bones found:', Object.keys(this.spinalBones).filter(key => this.spinalBones[key]).length);
        }
    }

    // Load VRoid pose data from file
    async loadVRoidPoseData(posePath = './pose.vroidpose') {
        try {
            console.log(`Loading VRoid pose data from ${posePath}...`);
            const response = await fetch(posePath);
            
            if (!response.ok) {
                throw new Error(`Failed to load pose file: ${response.status} ${response.statusText}`);
            }
            
            const poseData = await response.json();
            console.log('VRoid pose data loaded successfully:', poseData);
            
            return poseData;
        } catch (error) {
            console.error('Error loading VRoid pose data:', error);
            return null;
        }
    }

    // Apply VRoid pose from loaded data
    async applyVRoidPose(posePath = './pose.vroidpose') {
        if (!this.vrm.humanoid) return;
        
        console.log('Applying VRoid pose from .vroidpose file...');
        
        // Load pose data from file
        const vroidPoseData = await this.loadVRoidPoseData(posePath);
        if (!vroidPoseData) {
            console.warn('Failed to load pose data, using default natural pose');
            return;
        }
        
        // Get all relevant bone references including fingers
        const bones = this.getAllBoneReferences();
        
        // Extract bone definitions from VRoid pose data
        const boneDefinitions = vroidPoseData.BoneDefinition;
        if (!boneDefinitions) {
            console.error('No BoneDefinition found in VRoid pose data');
            return;
        }

        // Apply bone rotations from VRoid pose data
        this.applyBoneRotationsFromVRoidData(bones, boneDefinitions);

        // Apply initial head tilt - slightly looking up
        if (this.headBone) {
            this.headBone.rotation.x = -0.1; // Slight upward tilt
        }
        
        if (this.neckBone) {
            this.neckBone.rotation.x = -0.05; // Subtle neck support
        }
        
        // Apply natural finger poses (since we don't have the hand animation files)
        this.applyNaturalFingerPoses(bones);
        
        console.log('VRoid pose from .vroidpose file applied successfully');
        console.log('Applied VRoid coordinate system correction: x*-1, y*-1, z, w');
        console.log('Model coordinate system: Y-up, Z-forward (toward camera), X-right');
    }

    // Get all bone references for pose application
    getAllBoneReferences() {
        return {
            // Body bones
            hips: this.vrm.humanoid.getNormalizedBoneNode('hips'),
            spine: this.vrm.humanoid.getNormalizedBoneNode('spine'),
            chest: this.vrm.humanoid.getNormalizedBoneNode('chest'),
            upperChest: this.vrm.humanoid.getNormalizedBoneNode('upperChest'),
            leftShoulder: this.vrm.humanoid.getNormalizedBoneNode('leftShoulder'),
            rightShoulder: this.vrm.humanoid.getNormalizedBoneNode('rightShoulder'),
            leftUpperArm: this.vrm.humanoid.getNormalizedBoneNode('leftUpperArm'),
            rightUpperArm: this.vrm.humanoid.getNormalizedBoneNode('rightUpperArm'),
            leftLowerArm: this.vrm.humanoid.getNormalizedBoneNode('leftLowerArm'),
            rightLowerArm: this.vrm.humanoid.getNormalizedBoneNode('rightLowerArm'),
            leftHand: this.vrm.humanoid.getNormalizedBoneNode('leftHand'),
            rightHand: this.vrm.humanoid.getNormalizedBoneNode('rightHand'),
            
            // Finger bones - Left hand
            leftThumbProximal: this.vrm.humanoid.getNormalizedBoneNode('leftThumbProximal'),
            leftThumbIntermediate: this.vrm.humanoid.getNormalizedBoneNode('leftThumbIntermediate'),
            leftThumbDistal: this.vrm.humanoid.getNormalizedBoneNode('leftThumbDistal'),
            leftIndexProximal: this.vrm.humanoid.getNormalizedBoneNode('leftIndexProximal'),
            leftIndexIntermediate: this.vrm.humanoid.getNormalizedBoneNode('leftIndexIntermediate'),
            leftIndexDistal: this.vrm.humanoid.getNormalizedBoneNode('leftIndexDistal'),
            leftMiddleProximal: this.vrm.humanoid.getNormalizedBoneNode('leftMiddleProximal'),
            leftMiddleIntermediate: this.vrm.humanoid.getNormalizedBoneNode('leftMiddleIntermediate'),
            leftMiddleDistal: this.vrm.humanoid.getNormalizedBoneNode('leftMiddleDistal'),
            leftRingProximal: this.vrm.humanoid.getNormalizedBoneNode('leftRingProximal'),
            leftRingIntermediate: this.vrm.humanoid.getNormalizedBoneNode('leftRingIntermediate'),
            leftRingDistal: this.vrm.humanoid.getNormalizedBoneNode('leftRingDistal'),
            leftLittleProximal: this.vrm.humanoid.getNormalizedBoneNode('leftLittleProximal'),
            leftLittleIntermediate: this.vrm.humanoid.getNormalizedBoneNode('leftLittleIntermediate'),
            leftLittleDistal: this.vrm.humanoid.getNormalizedBoneNode('leftLittleDistal'),
            
            // Finger bones - Right hand
            rightThumbProximal: this.vrm.humanoid.getNormalizedBoneNode('rightThumbProximal'),
            rightThumbIntermediate: this.vrm.humanoid.getNormalizedBoneNode('rightThumbIntermediate'),
            rightThumbDistal: this.vrm.humanoid.getNormalizedBoneNode('rightThumbDistal'),
            rightIndexProximal: this.vrm.humanoid.getNormalizedBoneNode('rightIndexProximal'),
            rightIndexIntermediate: this.vrm.humanoid.getNormalizedBoneNode('rightIndexIntermediate'),
            rightIndexDistal: this.vrm.humanoid.getNormalizedBoneNode('rightIndexDistal'),
            rightMiddleProximal: this.vrm.humanoid.getNormalizedBoneNode('rightMiddleProximal'),
            rightMiddleIntermediate: this.vrm.humanoid.getNormalizedBoneNode('rightMiddleIntermediate'),
            rightMiddleDistal: this.vrm.humanoid.getNormalizedBoneNode('rightMiddleDistal'),
            rightRingProximal: this.vrm.humanoid.getNormalizedBoneNode('rightRingProximal'),
            rightRingIntermediate: this.vrm.humanoid.getNormalizedBoneNode('rightRingIntermediate'),
            rightRingDistal: this.vrm.humanoid.getNormalizedBoneNode('rightRingDistal'),
            rightLittleProximal: this.vrm.humanoid.getNormalizedBoneNode('rightLittleProximal'),
            rightLittleIntermediate: this.vrm.humanoid.getNormalizedBoneNode('rightLittleIntermediate'),
            rightLittleDistal: this.vrm.humanoid.getNormalizedBoneNode('rightLittleDistal')
        };
    }

    // Apply bone rotations from VRoid pose data
    applyBoneRotationsFromVRoidData(bones, boneDefinitions) {
        console.log('Applying bone rotations from VRoid pose data...');
        
        // Map VRoid bone names to VRM bone names
        const boneNameMapping = {
            'Hips': 'hips',
            'Spine': 'spine', 
            'Chest': 'chest',
            'UpperChest': 'upperChest',
            'LeftShoulder': 'leftShoulder',
            'RightShoulder': 'rightShoulder',
            'LeftUpperArm': 'leftUpperArm',
            'RightUpperArm': 'rightUpperArm',
            'LeftLowerArm': 'leftLowerArm',
            'RightLowerArm': 'rightLowerArm',
            'LeftHand': 'leftHand',
            'RightHand': 'rightHand'
        };

        // Apply rotations for mapped bones
        Object.keys(boneNameMapping).forEach(vroidBoneName => {
            const vrmBoneName = boneNameMapping[vroidBoneName];
            const boneData = boneDefinitions[vroidBoneName];
            
            if (boneData && bones[vrmBoneName]) {
                const { x, y, z, w } = boneData;
                // Apply VRoid coordinate system correction: invert x and y
                bones[vrmBoneName].quaternion.set(x * -1.0, y * -1.0, z, w);
                console.log(`Applied VRoid pose to ${vrmBoneName} with coordinate correction`);
            }
        });
    }

    // Apply natural finger poses (L_Natural/R_Natural equivalent)
    applyNaturalFingerPoses(bones) {
        console.log('Applying natural finger poses...');
        
        // Natural relaxed finger pose - slightly curved
        const naturalFingerCurl = {
            proximal: { x: 0.0, y: 0.0, z: 0.3 },      // Slight curl at base
            intermediate: { x: 0.0, y: 0.0, z: 0.4 },  // More curl at middle
            distal: { x: 0.0, y: 0.0, z: 0.2 }         // Slight curl at tip
        };
        
        // Thumb is positioned differently - more angled
        const naturalThumbPose = {
            proximal: { x: 0.2, y: 0.3, z: 0.1 },      // Thumb out and forward
            intermediate: { x: 0.1, y: 0.0, z: 0.2 },  // Slight bend
            distal: { x: 0.0, y: 0.0, z: 0.1 }         // Tip curl
        };

        // Apply to left hand fingers
        const leftFingers = ['Index', 'Middle', 'Ring', 'Little'];
        leftFingers.forEach(fingerName => {
            ['Proximal', 'Intermediate', 'Distal'].forEach(segment => {
                const boneName = `left${fingerName}${segment}`;
                if (bones[boneName]) {
                    const pose = naturalFingerCurl[segment.toLowerCase()];
                    bones[boneName].rotation.set(pose.x, pose.y, pose.z);
                    console.log(`Applied natural pose to ${boneName}`);
                }
            });
        });
        
        // Apply to right hand fingers
        const rightFingers = ['Index', 'Middle', 'Ring', 'Little'];
        rightFingers.forEach(fingerName => {
            ['Proximal', 'Intermediate', 'Distal'].forEach(segment => {
                const boneName = `right${fingerName}${segment}`;
                if (bones[boneName]) {
                    const pose = naturalFingerCurl[segment.toLowerCase()];
                    // Mirror for right hand: invert Y and Z as per documentation
                    bones[boneName].rotation.set(pose.x, -pose.y, -pose.z);
                    console.log(`Applied mirrored natural pose to ${boneName}`);
                }
            });
        });

        // Apply thumb poses
        ['Proximal', 'Intermediate', 'Distal'].forEach(segment => {
            // Left thumb
            const leftBoneName = `leftThumb${segment}`;
            if (bones[leftBoneName]) {
                const pose = naturalThumbPose[segment.toLowerCase()];
                bones[leftBoneName].rotation.set(pose.x, pose.y, pose.z);
                console.log(`Applied natural pose to ${leftBoneName}`);
            }
            
            // Right thumb (mirrored)
            const rightBoneName = `rightThumb${segment}`;
            if (bones[rightBoneName]) {
                const pose = naturalThumbPose[segment.toLowerCase()];
                bones[rightBoneName].rotation.set(pose.x, -pose.y, -pose.z);
                console.log(`Applied mirrored natural pose to ${rightBoneName}`);
            }
        });
        
        // Debug: Count available finger bones
        const fingerBoneNames = [
            'leftThumbProximal', 'leftThumbIntermediate', 'leftThumbDistal',
            'leftIndexProximal', 'leftIndexIntermediate', 'leftIndexDistal',
            'leftMiddleProximal', 'leftMiddleIntermediate', 'leftMiddleDistal',
            'leftRingProximal', 'leftRingIntermediate', 'leftRingDistal',
            'leftLittleProximal', 'leftLittleIntermediate', 'leftLittleDistal',
            'rightThumbProximal', 'rightThumbIntermediate', 'rightThumbDistal',
            'rightIndexProximal', 'rightIndexIntermediate', 'rightIndexDistal',
            'rightMiddleProximal', 'rightMiddleIntermediate', 'rightMiddleDistal',
            'rightRingProximal', 'rightRingIntermediate', 'rightRingDistal',
            'rightLittleProximal', 'rightLittleIntermediate', 'rightLittleDistal'
        ];
        
        const availableFingerBones = fingerBoneNames.filter(name => bones[name]).length;
        console.log(`Natural finger poses applied successfully (${availableFingerBones}/30 finger bones found)`);
    }

    // Create fallback for non-VRM files
    createFallbackVRM(gltf) {
        this.vrm = { 
            scene: gltf.scene,
            lookAt: null,
            update: () => {}
        };
        
        this.scene.add(this.vrm.scene);
        this.vrm.scene.position.set(0, -1.15, 0);
        this.vrm.scene.rotation.y = Math.PI;
        this.vrm.scene.scale.set(1, 1, 1);
    }

    // Create fallback cube
    createFallbackCube() {
        const geometry = new THREE.BoxGeometry(0.5, 0.8, 0.3);
        const material = new THREE.MeshLambertMaterial({ color: 0x00ff88 });
        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(0, -0.5, 0);
        this.scene.add(cube);
        
        this.vrm = {
            scene: cube,
            lookAt: null,
            update: () => {}
        };
        
        console.log('Fallback cube created');
    }

    // Update mouse position
    updateMousePosition(event) {
        this.mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouseY = (event.clientY / window.innerHeight) * 2 - 1;
    }

    // Animation loop
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const deltaTime = this.clock.getDelta();
        const elapsedTime = this.clock.getElapsedTime();
        
        if (this.vrm) {
            this.applyNaturalMotion(deltaTime, elapsedTime);
            this.applyHeadTracking(deltaTime, elapsedTime);
            
            // Update VRM
            this.vrm.update(deltaTime);
        }
        
        this.renderer.render(this.scene, this.camera);
    }

    // Apply natural breathing and rotation-based swaying motion
    applyNaturalMotion(deltaTime, elapsedTime) {
        // Apply subtle breathing motion to chest and upper chest - reduced intensity
        if (this.spinalBones.chest) {
            const breathingOffset = Math.sin(elapsedTime * this.breathingSpeed) * this.breathingIntensity;
            this.spinalBones.chest.rotation.x += breathingOffset * deltaTime;
        }
        
        if (this.spinalBones.upperChest) {
            const upperBreathingOffset = Math.sin(elapsedTime * this.breathingSpeed + 0.5) * this.breathingIntensity * 0.6;
            this.spinalBones.upperChest.rotation.x += upperBreathingOffset * deltaTime;
        }
        
        // Apply rotation-based swaying motion instead of leaning
        if (this.spinalBones.spine) {
            // Y-axis rotation (left-right turning) instead of X-axis leaning
            const spineRotationY = Math.sin(elapsedTime * this.swaySpeed) * this.swayIntensity * 0.8;
            const spineRotationZ = Math.cos(elapsedTime * this.swaySpeed * 1.2) * this.swayIntensity * 0.6;
            this.spinalBones.spine.rotation.y += spineRotationY * deltaTime;
            this.spinalBones.spine.rotation.z += spineRotationZ * deltaTime;
        }
        
        if (this.spinalBones.hips) {
            // Hip rotation motion - subtle weight shifting
            const hipRotationY = Math.sin(elapsedTime * this.swaySpeed + 0.8) * this.swayIntensity * 0.4;
            const hipRotationZ = Math.cos(elapsedTime * this.swaySpeed * 0.8) * this.swayIntensity * 0.3;
            this.spinalBones.hips.rotation.y += hipRotationY * deltaTime;
            this.spinalBones.hips.rotation.z += hipRotationZ * deltaTime;
        }
    }

    // Apply head tracking with natural bobbing
    applyHeadTracking(deltaTime, elapsedTime) {
        if (this.headBone || this.neckBone) {
            const targetRotationY = this.mouseX * 0.3; // Horizontal head turn
            const targetRotationX = (-this.mouseY * 0.2) - 0.1; // Vertical head tilt with upward bias
            
            if (this.headBone) {
                // Subtle head movement with gentle natural head bob
                const headBobX = Math.sin(elapsedTime * this.breathingSpeed * 0.8) * 0.015; // Reduced from 0.025
                const headBobY = Math.cos(elapsedTime * this.breathingSpeed * 0.5) * 0.008; // Reduced from 0.015
                const targetX = targetRotationX + headBobX;
                const targetY = targetRotationY + headBobY;
                
                this.headBone.rotation.y = THREE.MathUtils.lerp(this.headBone.rotation.y, targetY, 0.1);
                this.headBone.rotation.x = THREE.MathUtils.lerp(this.headBone.rotation.x, targetX, 0.1);
            }
            
            if (this.neckBone) {
                // Subtle neck movement to support head naturally
                const neckRotationY = targetRotationY * 0.5;
                const neckRotationX = (targetRotationX * 0.5) - 0.05; // Maintain upward tilt
                const neckBobX = Math.sin(elapsedTime * this.breathingSpeed * 0.6) * 0.008; // Reduced from 0.015
                const neckBobY = Math.cos(elapsedTime * this.breathingSpeed * 0.4) * 0.005; // Reduced from 0.008
                
                this.neckBone.rotation.y = THREE.MathUtils.lerp(this.neckBone.rotation.y, neckRotationY + neckBobY, 0.08);
                this.neckBone.rotation.x = THREE.MathUtils.lerp(this.neckBone.rotation.x, neckRotationX + neckBobX, 0.08);
            }
        }
        // Fallback: Use VRM lookAt for eye movement only if no head bones
        else if (this.vrm.lookAt) {
            const lookAtTarget = new THREE.Vector3(
                this.mouseX * 1.5,
                this.mouseY * 1.5,
                this.camera.position.z - 1
            );
            this.vrm.lookAt.lookAt(lookAtTarget);
        }
    }

    // Handle window resize
    onWindowResize() {
        this.renderer.setSize(200, 480);
    }

    // Test different body rotations to find correct coordinate system
    testRotation(rotationY = 0) {
        if (this.vrm && this.vrm.scene) {
            this.vrm.scene.rotation.y = rotationY;
            console.log(`Testing body rotation: ${rotationY} radians (${(rotationY * 180 / Math.PI).toFixed(1)}°)`);
        }
    }

    // Load and apply a different pose file dynamically
    async changePose(posePath) {
        if (!this.vrm || !this.vrm.humanoid) {
            console.error('Cannot change pose: VRM not loaded or no humanoid data');
            return false;
        }
        
        console.log(`Changing pose to: ${posePath}`);
        await this.applyVRoidPose(posePath);
        return true;
    }

    // Adjust lighting intensity for different effects
    adjustLighting(intensity = 1.0) {
        console.log(`Adjusting lighting intensity to ${intensity}`);
        
        this.scene.traverse((child) => {
            if (child.isDirectionalLight) {
                // Scale all directional lights
                child.intensity = child.userData.originalIntensity * intensity;
            } else if (child.isAmbientLight) {
                // Scale ambient light more conservatively
                child.intensity = child.userData.originalIntensity * (0.5 + intensity * 0.5);
            }
        });
    }

    // Store original light intensities for adjustment
    storeLightIntensities() {
        this.scene.traverse((child) => {
            if (child.isLight) {
                child.userData.originalIntensity = child.intensity;
            }
        });
    }

    // Adjust natural motion intensity
    adjustMotion(intensity = 1.0) {
        console.log(`Adjusting natural motion intensity to ${intensity}`);
        
        // Store original values if not stored
        if (!this.originalBreathingIntensity) {
            this.originalBreathingIntensity = 0.035;  // Updated to match current values
            this.originalSwayIntensity = 0.025;       // Updated to match current values
        }
        
        // Scale motion intensities
        this.breathingIntensity = this.originalBreathingIntensity * intensity;
        this.swayIntensity = this.originalSwayIntensity * intensity;
        
        console.log(`Breathing intensity: ${this.breathingIntensity.toFixed(3)}, Sway intensity: ${this.swayIntensity.toFixed(3)}`);
    }

    // Initialize and start the avatar
    async init(containerId = 'vrm-container', vrmPath = './Mahotsukai-jk.vrm', posePath = './pose.vroidpose') {
        if (!this.initScene(containerId)) {
            return false;
        }
        
        // Store pose path for reference
        this.currentPosePath = posePath;
        
        await this.loadVRM(vrmPath);
        this.animate();
        
        // Setup event listeners
        window.addEventListener('mousemove', (event) => this.updateMousePosition(event));
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Handle visibility changes (tab switching, window focus/blur)
        document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
        window.addEventListener('focus', () => this.handleWindowFocus());
        window.addEventListener('blur', () => this.handleWindowBlur());
        
        return true;
    }

    // Handle visibility changes (tab switching)
    handleVisibilityChange() {
        if (document.hidden) {
            // Page is hidden - pause or reduce processing
            console.log('VRM Avatar: Page hidden, reducing processing');
        } else {
            // Page is visible again - restore state
            console.log('VRM Avatar: Page visible, restoring state');
            this.restoreAvatarState();
        }
    }

    // Handle window focus
    handleWindowFocus() {
        console.log('VRM Avatar: Window focused, restoring state');
        this.restoreAvatarState();
    }

    // Handle window blur
    handleWindowBlur() {
        console.log('VRM Avatar: Window blurred');
        // Store current state if needed
    }

    // Restore avatar to proper state
    restoreAvatarState() {
        if (!this.vrm || !this.vrm.humanoid) return;

        // Reset clock to prevent large delta times
        this.clock.getDelta();
        
        // Reapply the pose to ensure bones are in correct position
        if (this.currentPosePath) {
            this.applyVRoidPose(this.currentPosePath);
        }

        // Reset head and neck to neutral position if they've drifted
        if (this.headBone) {
            this.headBone.rotation.x = THREE.MathUtils.lerp(this.headBone.rotation.x, -0.1, 0.1);
            this.headBone.rotation.y = THREE.MathUtils.lerp(this.headBone.rotation.y, 0, 0.1);
        }
        
        if (this.neckBone) {
            this.neckBone.rotation.x = THREE.MathUtils.lerp(this.neckBone.rotation.x, -0.05, 0.1);
            this.neckBone.rotation.y = THREE.MathUtils.lerp(this.neckBone.rotation.y, 0, 0.1);
        }

        // Ensure renderer is properly sized
        this.onWindowResize();

        console.log('VRM Avatar state restored');
    }
}