javascript:(function() {
    const e = {
        name: "MR ferrofluid",
        descriptionFunction() { return `spray <b>ferrofluid particles</b> that <b>attract</b> and <b>solidify</b><br>drains <b>2.2</b> <b class="color-f">energy</b> per second<br><strong>${this.ammoPack.toFixed(0)}</strong> shots per ${powerUps.orb.ammo()}`},
        ammo: 24000,
        ammoPack: 300,
        defaultAmmoPack: 300,
        have: false,
        cycle: 0,
        lastAngle: 0,
        wasMROn: false,
        isMROn: false,
        didMRDrain: false,
        canMRFire: true,
        MR() {
            const DRAIN = 0.0022;
            if (m.energy > DRAIN && this.canMRFire) {
                m.energy -= DRAIN;
                if (m.energy < 0) {
                    m.fieldCDcycle = m.cycle + 120;
                    m.energy = 0;
                }
                this.isMROn = true;
                const SPEED = 20;
                const me = bullet.length;
                const where = Vector.add(m.pos, player.velocity);
                bullet[me] = Bodies.polygon(where.x + 20 * Math.cos(m.angle), where.y + 20 * Math.sin(m.angle), 4, 0.01, {
                    cycle: -0.5,
                    isWave2: true,
                    endCycle: simulation.cycle + 50,
                    inertia: Infinity,
                    frictionAir: 0,
                    isInHole: true,
                    minDmgSpeed: 0,
                    dmg: m.dmgScale * 1.9,
                    classType: "bullet",
                    isBranch: false,
                    drawRadius: 1,
                    restitution: 0,
                    valueReduction: 1,
                    collisionFilter: {
                        category: cat.bullet,
                        mask: cat.map,
                    },
                    beforeDmg() { },
                    onEnd() { },
                    do() {
                        // const dist = Vector.magnitude(Vector.sub(this.position, m.pos));
                        // this.drawRadius = 20 - 2 * Math.abs(1 - dist / 100); 
                        this.drawRadius = Math.max(Math.max(this.endCycle - simulation.cycle, 0.1) - 10, 0.1);
                        if (this.endCycle < simulation.cycle + 1) { this.isWave2 = false; this.isBranch = true; };
                        for (let i = 0, len = mob.length; i < len; i++) {
                            const dist = Vector.magnitudeSquared(Vector.sub(this.position, mob[i].position));
                            const radius = mob[i].radius;
                            if (dist < radius * radius) {
                                if (mob[i].speed > 2) {
                                    if (mob[i].isBoss || mob[i].isShielded) {
                                        Matter.Body.setVelocity(mob[i], { x: mob[i].velocity.x * 0.95, y: mob[i].velocity.y * 0.95 });
                                    } else {
                                        Matter.Body.setVelocity(mob[i], { x: mob[i].velocity.x * 0.25, y: mob[i].velocity.y * 0.25 });
                                    }
                                }
                                let dmg = this.dmg / Math.min(10, mob[i].mass);
                                mob[i].damage(dmg);
                                if (mob[i].alive) mob[i].foundPlayer();
                            }
                        }
                        this.cycle++;
                        const wiggleMag = (m.crouch ? 3 : 9) * Math.cos(Math.sin(simulation.cycle) * 0.09);
                        const wiggle = Vector.mult(transverse, wiggleMag * Math.cos(this.cycle * 0.36));
                        const velocity = Vector.mult(player.velocity, 0.4);
                        if(m.crouch && Vector.magnitude(Vector.sub(this.position, m.pos)) > (Vector.magnitude(Vector.sub(simulation.mouseInGame, m.pos)) / 10) && !(Vector.magnitude(Vector.sub(this.position, m.pos)) > (Vector.magnitude(Vector.sub(simulation.mouseInGame, m.pos)) * 10))) {
                            this.endCycle += 1.01 * this.valueReduction;
                            this.valueReduction *= 0.95;
                        }
                        Matter.Body.setPosition(this, Vector.add(velocity, Vector.add(this.position, wiggle)));
                    }
                });
                Composite.add(engine.world, bullet[me]);
                Matter.Body.setVelocity(bullet[me], {
                    x: SPEED * Math.cos(m.angle),
                    y: SPEED * Math.sin(m.angle)
                });
                const transverse = Vector.normalise(Vector.perp(bullet[me].velocity));
                if (180 - Math.abs(Math.abs(this.lastAngle - m.angle) - 180) > 0.13 || !this.wasMROn) {
                    bullet[me].isBranch = true;
                    bullet[me].do = function () {
                        if (this.endCycle < simulation.cycle + 1) this.isWave = false;
                    };
                }
                this.lastAngle = m.angle;
            } else {
                this.canMRFire = false;
            }
        },
        do() {
            this.cycle++;
            if (input.fire) {
                this.wasMROn = true;
                this.canMRFire = true;
            } else {
                this.wasMROn = false;
                this.canMRFire = true;
            }
    
            ctx.beginPath();
            for (let i = bullet.length - 1; i > 0; --i) {
                if (bullet[i].isWave2) {
                    if (bullet[i].isBranch || bullet[i - 1].isBranch || bullet[Math.max(i - 2, 0)].isBranch || bullet[Math.min(i + 1, bullet.length - 1)].isBranch) {
                        ctx.moveTo(bullet[i].position.x, bullet[i].position.y);
                    } else {
                        ctx.lineTo(bullet[i].position.x, bullet[i].position.y);
                        ctx.lineWidth = bullet[i].drawRadius;
                        ctx.strokeStyle = "rgba(0, 0, 0, 0.05)"; // Black color for the fluid
                        ctx.stroke();
                    }
                }
            }
            ctx.beginPath();
            for (let i = bullet.length - 1; i > 0; --i) {
                if (bullet[i].isWave2) {
                    if (bullet[i].isBranch || bullet[i - 1].isBranch || bullet[Math.max(i - 2, 0)].isBranch || bullet[Math.min(i + 1, bullet.length - 1)].isBranch) {
                        ctx.moveTo(bullet[i].position.x, bullet[i].position.y);
                    } else {
                        ctx.lineTo(bullet[i].position.x + (Math.random() * 50) - (Math.random() * 50), bullet[i].position.y + (Math.random() * 50) - (Math.random() * 50));
                        ctx.lineWidth = 2;
                        ctx.strokeStyle = "rgba(100, 20, 220, 0.1)";
                        ctx.stroke();
                    }
                }
            }
            if(m.crouch) {
                for (let i = bullet.length - 1; i > 0; --i) {
                    if(bullet[i].isWave2) {
                        bullet[i].force = Vector.mult(Vector.normalise(Vector.sub(bullet[i].position, simulation.mouseInGame)), -bullet[i].mass * 0.015);
                        if (this.speed > 6) {
                            Matter.Body.setVelocity(bullet[i], { x: bullet[i].velocity.x * 0.9, y: bullet[i].velocity.y * 0.9 });
                        }
                    }
                }
            }
            // ctx.save();
            // ctx.globalAlpha = (m.immuneCycle < m.cycle) ? 1 : 0.5 //|| (m.cycle % 40 > 20)
            // ctx.translate(m.pos.x, m.pos.y);
            // ctx.rotate(m.angle);
            // ctx.beginPath();
            // ctx.arc(0, 0, 30, 0, 2 * Math.PI);
            // ctx.fillStyle = m.bodyGradient
            // ctx.fill();
            // ctx.arc(15, 0, 4, 0, 2 * Math.PI);
            // ctx.strokeStyle = "#333";
            // ctx.lineWidth = 2;
            // ctx.stroke();
            // ctx.restore();
        },
        fire() {
            this.MR();
        }
    };       
	b.guns.push(e);
	const gunArray = b.guns.filter(
	(obj, index, self) =>
		index === self.findIndex((item) => item.name === obj.name)
	);
	b.guns = gunArray;
	const t = [ //finishing this? hell naw
		{
			name: "neodymium magnet",
			descriptionFunction() {
				return `MMRF <b>condenses</b> into a spiked ball<br>increased <b class="color-d">damage</b> and <b class="color-f">energy</b> drain`
			},
			isGunTech: true,
			maxCount: 1,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() {
				return tech.haveGunCheck("MR ferrofluid")
			},
			requires: "magnetorheological ferrofluid",
			effect() {
                tech.magnitize = true;
			},
			remove() {
                tech.magnitize = true;
			}
		},
	];
	t.reverse();
	for(let i = 0; i < tech.tech.length; i++) {
		if(tech.tech[i].name === 'spherical harmonics') {
			for(let j = 0; j < t.length; j++) {
				tech.tech.splice(i, 0, t[j]);
			}
			break;
		}
	}
	// tech.tech.push()
	const techArray = tech.tech.filter(
		(obj, index, self) =>
			index === self.findIndex((item) => item.name === obj.name)
		);
	tech.tech = techArray;
	console.log("%cFluid mod successfully installed", "color: gray");
})();
