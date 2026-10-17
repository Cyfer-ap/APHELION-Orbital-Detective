"""Rebuild the bundled stylized globe texture from Basemap/GSHHS coastline polygons."""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from mpl_toolkits.basemap import Basemap
from pathlib import Path

W, H = 2048, 1024
rng = np.random.default_rng(2026)
lat = np.linspace(90, -90, H)[:, None]
lon = np.linspace(-180, 180, W)[None, :]
noise = rng.standard_normal((H, W))
coarse = Image.fromarray(rng.integers(0, 256, (H//16, W//16), dtype=np.uint8)).resize((W,H), Image.Resampling.BICUBIC)
coarse_arr = (np.asarray(coarse, dtype=np.float32) - 128) / 128
water_light = 0.6*np.cos(np.radians(lat*1.6)) + 0.4*np.cos(np.radians(lon*.8)) + 0.16*coarse_arr + 0.025*noise
water = np.zeros((H,W,3),dtype=np.float32)
water[:,:,0] = 5 + 10 * water_light
water[:,:,1] = 25 + 28 * water_light
water[:,:,2] = 58 + 43 * water_light
mask = Image.new('L',(W,H),0)
draw = ImageDraw.Draw(mask)
m = Basemap(projection='cyl',llcrnrlon=-180,urcrnrlon=180,llcrnrlat=-90,urcrnrlat=90,resolution='c')
for p in m.landpolygons:
    coords = p.get_coords()
    xy = [((x+180)*W/360,(90-y)*H/180) for x,y in coords]
    if len(xy)>2: draw.polygon(xy, fill=255)
mask_arr=np.asarray(mask,dtype=np.float32)/255.0
hot = np.maximum(0, 1-np.abs(lat)/60)
land_light = .2*coarse_arr + .05*noise
land = np.zeros((H,W,3),dtype=np.float32)
land[:,:,0] = 32 + 32*hot + 15*land_light
land[:,:,1] = 74 - 18*hot + 18*land_light
land[:,:,2] = 76 - 40*hot + 18*land_light
ice = (np.abs(lat)>77).astype('float32')
land = land * (1-ice[:,:,None]*.72) + np.stack([np.ones((H,W))*174,np.ones((H,W))*206,np.ones((H,W))*210],axis=2)*ice[:,:,None]*.72
out = np.clip(water * (1-mask_arr[:,:,None]) + land*mask_arr[:,:,None],0,255).astype('uint8')
img=Image.fromarray(out, 'RGB')
coast=ImageDraw.Draw(img, 'RGBA')
for p in m.landpolygons:
    coords = p.get_coords()
    xy = [((x+180)*W/360,(90-y)*H/180) for x,y in coords]
    if len(xy)>2: coast.line(xy+[xy[0]],fill=(84,166,165,135),width=1)
img.save(Path(__file__).parent/'frontend'/'public'/'earth-stylized.jpg', quality=89, optimize=True)
print('Earth texture generated')
