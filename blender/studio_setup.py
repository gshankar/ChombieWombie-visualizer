import bpy
import os

# ChombieWombie Studio Setup Script for Blender
# This script clears the scene, builds a reactive Neon Tunnel, and bakes audio.

def setup_chombiewombie_studio(audio_path):
    # --- 0. CLEAN THE SCENE ---
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

    # --- 1. SETUP CONTROLLER ---
    bpy.ops.mesh.primitive_plane_add(size=0.1)
    ctrl = bpy.context.active_object
    ctrl.name = "CW_Controller"
    ctrl.hide_viewport = True
    ctrl.hide_render = True
    
    # --- 2. CREATE NEON MATERIAL ---
    mat_name = "CW_Neon_Glow"
    mat = bpy.data.materials.new(name=mat_name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    emit = nodes.new('ShaderNodeEmission')
    emit.inputs['Color'].default_value = (0, 0.95, 1, 1) # Cyan
    emit.inputs['Strength'].default_value = 20.0 
    out = nodes.new('ShaderNodeOutputMaterial')
    mat.node_tree.links.new(emit.outputs['Emission'], out.inputs['Surface'])

    # --- 3. BUILD THE TUNNEL ---
    bpy.ops.mesh.primitive_cylinder_add(radius=1, depth=0.1)
    tunnel = bpy.context.active_object
    tunnel.name = "CW_Tunnel"
    tunnel.data.materials.append(mat)
    
    # Setup Geometry Nodes
    gn_mod = tunnel.modifiers.new(name="CW_Logic", type='NODES')
    group = bpy.data.node_groups.new(name="CW_Tunnel_Nodes", type='GeometryNodeTree')
    gn_mod.node_group = group
    nodes = group.nodes
    links = group.links
    
    in_node = nodes.new('NodeGroupInput')
    out_node = nodes.new('NodeGroupOutput')
    circle = nodes.new('GeometryNodeMeshCircle')
    circle.inputs['Vertices'].default_value = 64
    line = nodes.new('GeometryNodeMeshLine')
    line.inputs['Count'].default_value = 150
    line.inputs['Offset'].default_value = (0, 0, 0.5)
    
    inst = nodes.new('GeometryNodeInstanceOnPoints')
    links.new(line.outputs['Mesh'], inst.inputs['Points'])
    links.new(circle.outputs['Mesh'], inst.inputs['Instance'])
    
    obj_info = nodes.new('GeometryNodeObjectInfo')
    obj_info.inputs['Object'].default_value = ctrl
    
    trans = nodes.new('GeometryNodeTransform')
    links.new(inst.outputs['Instances'], trans.inputs['Geometry'])
    links.new(obj_info.outputs['Location'], trans.inputs['Scale'])
    
    links.new(trans.outputs['Geometry'], out_node.inputs[0])
    
    # Rotate tunnel to face the "camera"
    tunnel.rotation_euler[0] = 1.5708 # 90 degrees

    # --- 4. THE CONTEXT-FORCE BAKE ---
    if os.path.exists(audio_path):
        print(f"Baking Audio: {audio_path}")
        
        # 1. Prepare the channel
        ctrl.location = (1, 1, 1)
        ctrl.keyframe_insert(data_path="location", index=0) # X
        ctrl.keyframe_insert(data_path="location", index=1) # Y
        ctrl.keyframe_insert(data_path="location", index=2) # Z
        
        # 2. Select the object
        bpy.context.view_layer.objects.active = ctrl
        ctrl.select_set(True)

        # 3. Find ANY area to temporarily use as a Graph Editor
        # We'll use the current area where the script is running
        area = bpy.context.area
        old_type = area.type
        area.type = 'GRAPH_EDITOR'
        
        # 4. Bake it
        try:
            bpy.ops.graph.sound_bake(filepath=audio_path, low=0, high=250)
            print("Successfully baked Bass to Tunnel!")
        except Exception as e:
            print(f"Bake error: {e}")
        finally:
            # 5. Restore the window back to a Script Editor
            area.type = old_type
            
        print("Success! Press SPACE to play.")
    else:
        print(f"Error: File not found at {audio_path}")

# --- YOUR DIRECT FILE PATH ---
MY_MP3_PATH = '/Users/gday.ganesh/Downloads/2026-03-29 Ultimate Betrayal.mp3'

if __name__ == "__main__":
    setup_chombiewombie_studio(MY_MP3_PATH)
