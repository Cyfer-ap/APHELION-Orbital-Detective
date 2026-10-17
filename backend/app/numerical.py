"""Educational Newtonian two-body integration versus analytic Kepler solution.

Inertial-frame norms are computed from full-precision Cartesian states. `step_seconds`
is a maximum substep, with shorter alignment steps at output boundaries. Verlet
is therefore not strictly a fixed-step symplectic integrator in this experiment.
No atmospheric drag/J2/operational orbit determination.
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
import math
from .explorer import MU_KM3_S2 as MU, EARTH_RADIUS_KM as R, anomaly_to_mean, eccentric_anomaly, gmst_radians


def norm(x): return math.sqrt(sum(v*v for v in x))


def rotate(p, inc, node, peri):
    x,y,z=p; c,s=math.cos(peri),math.sin(peri);x,y=c*x-s*y,s*x+c*y
    c,s=math.cos(inc),math.sin(inc);y,z=c*y-s*z,s*y+c*z
    c,s=math.cos(node),math.sin(node);return (c*x-s*y,s*x+c*y,z)


def initial_state(a,e,inc,node,peri,nu):
    p=a*(1-e*e); radius=p/(1+e*math.cos(nu)); h=math.sqrt(MU/p)
    return (*rotate((radius*math.cos(nu),radius*math.sin(nu),0.),inc,node,peri),
            *rotate((-h*math.sin(nu),h*(e+math.cos(nu)),0.),inc,node,peri))


def rhs(s):
    x,y,z,vx,vy,vz=s; radius=norm(s[:3]);
    if radius<R/2: raise ValueError('Numerical trajectory entered an invalid central region')
    f=-MU/radius**3
    return (vx,vy,vz,f*x,f*y,f*z)


def added(a,b,f):return tuple(x+y*f for x,y in zip(a,b))


def step(s,h,method):
    if method=='euler':return added(s,rhs(s),h)
    if method=='rk4':
        k1=rhs(s);k2=rhs(added(s,k1,h/2));k3=rhs(added(s,k2,h/2));k4=rhs(added(s,k3,h))
        return tuple(x+h*(a+2*b+2*c+d)/6 for x,a,b,c,d in zip(s,k1,k2,k3,k4))
    if method=='verlet':
        x,y,z,vx,vy,vz=s;ax,ay,az=rhs(s)[3:]
        xyz=(x+h*vx+ax*h*h/2,y+h*vy+ay*h*h/2,z+h*vz+az*h*h/2)
        bx,by,bz=rhs((*xyz,vx,vy,vz))[3:]
        return (*xyz,vx+h*(ax+bx)/2,vy+h*(ay+by)/2,vz+h*(az+bz)/2)
    raise ValueError('Unknown integrator')


def energy(s):return norm(s[3:])**2/2-MU/norm(s[:3])


def momentum(s):
    x,y,z,vx,vy,vz=s
    return norm((y*vz-z*vy,z*vx-x*vz,x*vy-y*vx))


def globe_state(s,instant):
    x,y,z,vx,vy,vz=s;theta=gmst_radians(instant)
    xe=x*math.cos(theta)+y*math.sin(theta);ye=-x*math.sin(theta)+y*math.cos(theta)
    return {'time':instant.isoformat(timespec='milliseconds').replace('+00:00','Z'),
            'lat':round(math.degrees(math.atan2(z,math.hypot(xe,ye))),6),
            'lon':round((math.degrees(math.atan2(ye,xe))+540)%360-180,6),
            'alt_km':round(norm(s[:3])-R,4),'speed_km_s':round(norm((vx,vy,vz)),6)}


def compare_propagators(epoch:datetime,altitude_km=450.,inclination_deg=51.6,
                        eccentricity=.24,raan_deg=35.,argument_of_periapsis_deg=60.,
                        phase_deg_at_epoch=0.,method='rk4',step_seconds=120.,duration_orbits=2):
    if epoch.tzinfo is None:raise ValueError('Epoch must have a timezone offset')
    elements=(altitude_km,inclination_deg,eccentricity,raan_deg,argument_of_periapsis_deg,phase_deg_at_epoch,step_seconds)
    if (not all(math.isfinite(v) for v in elements) or
        not (200<=altitude_km<=2000 and 0<=inclination_deg<=180 and 0<=eccentricity<=.35 and
             0<=raan_deg<=360 and 0<=argument_of_periapsis_deg<=360 and 0<=phase_deg_at_epoch<=360 and
             10<=step_seconds<=360) or method not in ('euler','verlet','rk4') or
        type(duration_orbits)!=int or not 1<=duration_orbits<=3):
        raise ValueError('One or more integration parameters are outside supported bounds')
    epoch=epoch.astimezone(timezone.utc)
    a=(R+altitude_km)/(1-eccentricity)
    i,node,peri,nu=map(math.radians,(inclination_deg,raan_deg,argument_of_periapsis_deg,phase_deg_at_epoch))
    base=initial_state(a,eccentricity,i,node,peri,nu)
    e0=energy(base);h0=momentum(base)
    mean0=anomaly_to_mean(nu,eccentricity)
    n=math.sqrt(MU/a**3);period=2*math.pi/n
    def exact(seconds):
        E=eccentric_anomaly(mean0+n*seconds,eccentricity)
        anomaly=math.atan2(math.sqrt(1-eccentricity**2)*math.sin(E),math.cos(E)-eccentricity)
        return initial_state(a,eccentricity,i,node,peri,anomaly)
    refs=[];num=[];errors=[];previous=0.;current=base;substeps=0;max_err=0.;max_energy=0.;max_momentum=0.
    # The output grid becomes sparser for large requested steps, so a coarse
    # 360-second setting actually integrates over 360-second intervals instead
    # of silently becoming identical to a smaller setting. Max 181 samples.
    total=period*duration_orbits
    sample_count=min(181,max(13,int(total/step_seconds)+1))
    for index in range(sample_count):
        t=total*index/(sample_count-1)
        remaining=t-previous
        while remaining>1e-9:
            h=min(remaining,step_seconds)
            current=step(current,h,method);remaining-=h;substeps+=1
        previous=t;truth=exact(t)
        deviation=norm([current[j]-truth[j] for j in range(3)])
        energy_drift=abs((energy(current)-e0)/e0)*100
        momentum_drift=abs((momentum(current)-h0)/h0)*100
        if not all(map(math.isfinite,(*current,deviation,energy_drift,momentum_drift))):
            raise ValueError('Integrator produced a nonfinite orbital state')
        max_err=max(max_err,deviation);max_energy=max(max_energy,energy_drift);max_momentum=max(max_momentum,momentum_drift)
        moment=epoch+timedelta(seconds=t)
        refs.append(globe_state(truth,moment));num.append(globe_state(current,moment))
        errors.append({'elapsed_minutes':round(t/60,5),'position_error_km':round(deviation,8),
                       'relative_energy_drift_pct':round(energy_drift,9),
                       'relative_angular_momentum_drift_pct':round(momentum_drift,9)})
    return {'kind':'two_body_numerical_comparison',
            'epoch_utc':epoch.isoformat(timespec='milliseconds').replace('+00:00','Z'),
            'parameters':{'altitude_km':altitude_km,'inclination_deg':inclination_deg,
                          'eccentricity':eccentricity,'raan_deg':raan_deg,
                          'argument_of_periapsis_deg':argument_of_periapsis_deg,'phase_deg_at_epoch':phase_deg_at_epoch},
            'model':{'method':method,'step_seconds':step_seconds,'duration_orbits':duration_orbits,
                     'period_minutes':round(period/60,4),'max_substep_seconds':step_seconds,'integration_substeps':substeps},
            'reference_track':refs,'numerical_track':num,'diagnostics':errors,
            'summary':{'final_error_km':errors[-1]['position_error_km'],'max_error_km':round(max_err,8),
                       'max_energy_drift_pct':round(max_energy,9),
                       'max_angular_momentum_drift_pct':round(max_momentum,9)},
            'assumptions':['Both tracks start from the exact same ECI Cartesian state and evolve under two-body gravity.',
                           'The analytic reference solves Kepler’s equation; integration advances r_dot=v, v_dot=-μr/r³.',
                           'Input step is a maximum; shortened output-alignment substeps mean Verlet is not strictly fixed-step symplectic.',
                           'ECI Euclidean position errors are computed before rounding/display.',
                           'Not SGP4, no atmospheric drag, J2, maneuvers, uncertainty, or flight-operation claims.']}
