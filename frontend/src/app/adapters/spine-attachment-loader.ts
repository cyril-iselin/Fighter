// ============================================================================
// Custom Atlas Attachment Loader
// Handles name format mismatch between Atlas and JSON
// ============================================================================

import * as spine from '@esotericsoftware/spine-webgl';

export class CustomAtlasAttachmentLoader implements spine.AttachmentLoader {
  private atlas: spine.TextureAtlas;
  
  constructor(atlas: spine.TextureAtlas) {
    this.atlas = atlas;
  }
  
  private findRegion(name: string): spine.TextureAtlasRegion | null {
    // First try exact match
    let region = this.atlas.findRegion(name);
    if (region) return region;
    
    // Try converting _XXXXX format to index format
    const match = name.match(/^(.+)_(\d+)$/);
    if (match) {
      const baseName = match[1];
      const index = parseInt(match[2], 10);
      
      for (const r of this.atlas.regions) {
        if (r.name === baseName && r.index === index) {
          return r;
        }
      }
    }
    
    return null;
  }
  
  newRegionAttachment(skin: spine.Skin, name: string, path: string): spine.RegionAttachment {
    const region = this.findRegion(path);
    if (!region) {
      throw new Error(`Region not found in atlas: ${path} (attachment: ${name})`);
    }
    
    const attachment = new spine.RegionAttachment(name, path);
    attachment.region = region;
    attachment.updateRegion();
    return attachment;
  }
  
  newMeshAttachment(skin: spine.Skin, name: string, path: string): spine.MeshAttachment {
    const region = this.findRegion(path);
    if (!region) {
      throw new Error(`Region not found in atlas: ${path} (mesh attachment: ${name})`);
    }
    
    const attachment = new spine.MeshAttachment(name, path);
    attachment.region = region;
    return attachment;
  }
  
  newBoundingBoxAttachment(skin: spine.Skin, name: string): spine.BoundingBoxAttachment {
    return new spine.BoundingBoxAttachment(name);
  }
  
  newPathAttachment(skin: spine.Skin, name: string): spine.PathAttachment {
    return new spine.PathAttachment(name);
  }
  
  newPointAttachment(skin: spine.Skin, name: string): spine.PointAttachment {
    return new spine.PointAttachment(name);
  }
  
  newClippingAttachment(skin: spine.Skin, name: string): spine.ClippingAttachment {
    return new spine.ClippingAttachment(name);
  }
}
