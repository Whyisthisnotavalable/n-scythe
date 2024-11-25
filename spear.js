javascript:(function() {
	const e = {
		name: "spear",
		descriptionFunction() { return `control a <b>spear</b> that has <em style="color: gray;">durability</em><br>spear is <b>controlled</b> by <b>cursor</b><br><strong>${tech.isAmmoForGun ? 30 - (tech.tempering ? tech.tempering : 0) : 15 - (tech.tempering ? tech.tempering : 0)}</strong> </em style="color: gray;">durability</em> per ${powerUps.orb.ammo()}`},
		ammo: Infinity,
		ammoPack: Infinity,
		defaultAmmoPack: Infinity,
        have: false,
        orbitals: [],
		bladeSegments: undefined,
		bladeTrails: [],
		spear: undefined,
		angle: undefined,
		constraint1: undefined,
		constraint2: undefined,
		cycle: 0,
		durability: 300,
		maxDurability: 300,
		haveEphemera: false,
		fire() {},
		do() {
			if(!this.haveEphemera) {
				this.haveEphemera = true;
				simulation.ephemera.push({
					name: "spear",
					do() {
						if(b.guns[b.activeGun].name !== 'spear') {
							for (let i = 0, len = b.inventory.length; i < len; ++i) {
								if(b.guns[b.inventory[i]].name === "spear" && b.guns[b.inventory[i]].spear) {
									b.guns[b.inventory[i]].cycle = 0;
									if(b.guns[b.inventory[i]].constraint1) {
										Composite.remove(engine.world, b.guns[b.inventory[i]].constraint1);
										b.guns[b.inventory[i]].constraint1 = undefined;
									}
									if(b.guns[b.inventory[i]].constraint2) {
										Composite.remove(engine.world, b.guns[b.inventory[i]].constraint2);
										b.guns[b.inventory[i]].constraint2 = undefined;
									}
									Composite.remove(engine.world, b.guns[b.inventory[i]].spear);
									b.guns[b.inventory[i]].spear.parts.forEach(part => {
										Composite.remove(engine.world, part);
										const index = bullet.indexOf(part);
										if (index !== -1) {
											bullet.splice(index, 1);
										}
									});
									b.guns[b.inventory[i]].spear = undefined;
									b.guns[b.inventory[i]].bladeTrails = [];
								}
							}
						}
						for (let i = 0, len = b.inventory.length; i < len; ++i) {
							if(b.guns[b.inventory[i]].name === "spear") {
								document.getElementById(b.inventory[i]).innerHTML = `${b.guns[b.inventory[i]].name} - ${b.guns[b.inventory[i]].durability}/${b.guns[b.inventory[i]].maxDurability} <em style="font-size: 20px;">durability</em>`
							}
						}
					},
				})
			}
			if(this.cycle === 0) {
				const oldEffect = powerUps.ammo.effect;
				powerUps.ammo.effect = () => {
					oldEffect();
					for (let i = 0, len = b.inventory.length; i < len; ++i) {
						if(b.guns[b.inventory[i]].name === "spear") {
							b.guns[b.inventory[i]].durability += (tech.isAmmoForGun && b.guns[b.activeGun].name === 'spear') ? 30 - (tech.tempering ? tech.tempering : 0): 15 - (tech.tempering ? tech.tempering : 0);
						}
					}
				}
			}
			this.cycle++;
			this.durability = Math.min(this.maxDurability, Math.max(0, this.durability));
			for (let i = 0, len = b.inventory.length; i < len; ++i) {
				if(b.guns[b.inventory[i]].name === "spear") {
					document.getElementById(b.inventory[i]).innerHTML = `${b.guns[b.inventory[i]].name} - ${this.durability}/${this.maxDurability} <em style="font-size: 20px;">durability</em>`
				}
			}
			if (input.fire && this.durability > 0 && m.fireCDcycle < m.cycle) {
				if (!this.spear && b.guns[b.activeGun].name === 'spear') {
					({ spear: this.spear, bladeSegments: this.bladeSegments} = this.createSpear(player.position));
					this.angle = m.angle;
				}
			}
			if(this.spear) {
				// Matter.Body.setVelocity(this.spear, {x: this.spear.velocity.x * 0.99, y: this.spear.velocity.y * 0.99})
				if(!this.constraint1) {
					this.constraint1 = Constraint.create({
						pointA: player.position,
						bodyB: this.spear,
						pointB: {x: Math.cos(m.angle) * -100, y: Math.sin(m.angle) * -100},
						stiffness: 0.1,
						damping: 0.0000001815,
						length: 0,
						
					});
					Composite.add(engine.world, this.constraint1);
				}
				if(!this.constraint2) {
					this.constraint2 = Constraint.create({
						pointA: simulation.mouseInGame,
						bodyB: this.spear,
						pointB: {x: Math.cos(m.angle) * 100, y: Math.sin(m.angle) * 100},
						stiffness: 0.1,
						damping: 0.0000001815,
						length: 0,
						
					});
					Composite.add(engine.world, this.constraint2);
				}
			}
			if(this.spear && !input.fire) {
				this.cycle = 0;
				if(this.constraint1) {
					Composite.remove(engine.world, this.constraint1);
					this.constraint1 = undefined;
				}
				if(this.constraint2) {
					Composite.remove(engine.world, this.constraint2);
					this.constraint2 = undefined;
				}
				Composite.remove(engine.world, this.spear);
				this.spear.parts.forEach(part => {
					Composite.remove(engine.world, part);
					const index = bullet.indexOf(part);
					if (index !== -1) {
						bullet.splice(index, 1);
					}
				});
				this.spear = undefined;
				this.bladeTrails = [];
				m.fireCDcycle = m.cycle + 10;
			}
			this.collision();
			//this.drawDurability();
			if(tech.pyroSpear && this.spear) {
				const range = 500 + 140 * Math.sin(simulation.cycle / 100);
				const dmg = 0.03 * m.dmgScale;
				for (let i = 0; i < mob.length; i++) {
					const distance = Vector.magnitude(Vector.sub(this.spear.position, mob[i].position))
					if (distance < range) {
						mob[i].damage(dmg);
						mob[i].locatePlayer();
					}
				}
				if (this.oldSpear === undefined) {
					this.oldSpear = { position: { x: 0, y: 0 } };
				}
				const t = 0.1;
				let interpolateX = (1 - t) * this.oldSpear.position.x + t * this.spear.position.x;
				let interpolateY = (1 - t) * this.oldSpear.position.y + t * this.spear.position.y;
				this.drawPerlinWaveCircle(interpolateX, interpolateY, range);
				this.oldSpear.position = this.spear.position;
			}
			if(tech.shockSpear) {
				this.renderLightning();
				if(this.spear) {
					m.energy -= 0.001;
				}
			} else if(tech.pyroSpear) {
				this.renderFlame();
			} else {
				this.renderDefault();
			}
			if(tech.spearArc && this.spear) {
				const dmg = 0.0001 * m.dmgScale;
				const arcList = [];
				const damageRadius = 1000;
				const dischargeRange = 1700;
				for (let i = 0, len = mob.length; i < len; i++) {
					if (mob[i].alive && (!mob[i].isBadTarget || mob[i].isMobBullet) && !mob[i].isInvulnerable) {
						const sub = Vector.magnitude(Vector.sub(this.spear.position, mob[i].position))
						if (sub < damageRadius + mob[i].radius) {
							arcList.push(mob[i]);
							Matter.Body.setVelocity(mob[i], {x: mob[i].velocity.x * 0.95, y:  mob[i].velocity.y * 0.95})
						}
					}
				}
				for (let i = 0; i < arcList.length; i++) {
					if (tech.spearArc * 0.1 > Math.random()) {
						const who = arcList[Math.floor(Math.random() * arcList.length)]
						who.damage(dmg * 4);
						const sub = Vector.sub(who.position, this.spear.position)
						const unit = Vector.normalise(sub)
						let len = 12
						const step = Vector.magnitude(sub) / (len + 2)
						let x = this.spear.position.x
						let y = this.spear.position.y
						ctx.beginPath();
						ctx.moveTo(x, y);
						for (let i = 0; i < len; i++) {
							x += step * (unit.x + (Math.random() - 0.5))
							y += step * (unit.y + (Math.random() - 0.5))
							ctx.lineTo(x, y);
						}
						ctx.lineTo(who.position.x, who.position.y);
						ctx.strokeStyle = "rgb(220, 20, 220)";
						ctx.lineWidth = 4 + 3 * Math.random();
						ctx.stroke();
					}
				}
			}
        },
		fade(t) {
			return t * t * t * (t * (t * 6 - 15) + 10);
		},
		lerp(t, a, b) {
			return a + t * (b - a);
		},
		grad(hash, x) {
			const h = hash & 15; // Convert low 4 bits of hash code
			const u = h < 8 ? x : 0; // Gradient value 1-8
			const v = h < 4 ? 0 : (h === 12 || h === 14 ? x : 0); // Gradient value 9-12
			return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v); // Return the final gradient
		},
		p: [],
		perm: [],
		setPerm() {
			for (let i = 0; i < 256; i++) {
				this.p[i] = Math.floor(Math.random() * 256);
			}
			for (let i = 0; i < 512; i++) {
				this.perm[i] = p[i & 255];
			}
		},
		noise(x) {
			const X = Math.floor(x) & 255;
			x -= Math.floor(x);
			const u = this.fade(x);
			return this.lerp(u, this.grad(this.perm[X], x), this.grad(this.perm[X + 1], x - 1));
		},
		drawPerlinWaveCircle(x, y, radius) {
			if(this.perm == []) {
				this.setPerm();
			}
			ctx.beginPath();
			const points = 100;
			const noiseScale = 0.9;
			const timeFactor = simulation.cycle * 0.02;
			for (let i = 0; i <= points; i++) {
				const angle = (i / points) * 2 * Math.PI; 
				
				const noiseValue = this.noise(Math.cos(angle + timeFactor) * noiseScale - timeFactor);
				
				const r = radius + (radius * noiseValue * 0.5);
				
				const xPos = x + r * Math.cos(angle);
				const yPos = y + r * Math.sin(angle);
				
				if (i === 0) {
					ctx.moveTo(xPos, yPos);
				} else {
					ctx.lineTo(xPos, yPos);
				}
			}
			const grd = ctx.createRadialGradient(x, y, 300, x, y, 1000);
			grd.addColorStop(0, `rgba(255, 69, ${Math.abs(Math.sin(simulation.cycle / 30)) * 255}, 0.8)`);
			grd.addColorStop(1, "transparent");
			ctx.closePath();
			ctx.strokeStyle = `rgba(255, 69, ${Math.abs(Math.sin(simulation.cycle / 30)) * 255}, 0.8)`;
			ctx.fillStyle = grd;
			ctx.lineWidth = 2; // Line width
			ctx.stroke();
			ctx.fill();
		},
		createSpear(position) {
			let x = position.x;
			let y = position.y;
			let angle = m.angle;
			const handleWidth = 20;
			const handleHeight = 500;

			const handle = Bodies.rectangle(x, y, handleWidth, handleHeight, spawn.propsIsNotHoldable);
			if(!tech.pyroSpear) {
				bullet[bullet.length] = handle;
				bullet[bullet.length - 1].do = () => {};
			}

			const pommelWidth = 30;
			const pommelHeight = 40;
			const pommelVertices = [
				{ x: x, y: y + handleHeight / 2 + pommelHeight / 2 },
				{ x: x + pommelWidth / 2, y: y + handleHeight / 2 },
				{ x: x, y: y + handleHeight / 2 - pommelHeight / 2 },
				{ x: x - pommelWidth / 2, y: y + handleHeight / 2 },
			];
			const pommel = Bodies.fromVertices(x, y + handleHeight / 2, pommelVertices, spawn.propsIsNotHoldable);
			if(!tech.pyroSpear) {
				bullet[bullet.length] = pommel;
				bullet[bullet.length - 1].do = () => {};
			}
			const prongWidth = 20;
			const prongHeight = 300;
			const prongOffsetX = 30;

			const leftOuterProngVertices = [
				{ x: x - prongOffsetX, y: y - handleHeight / 2 - prongHeight },
				{ x: x - prongOffsetX - prongWidth, y: y - handleHeight / 2 - prongHeight / 2 },
				{ x: x - prongOffsetX - prongWidth, y: y - handleHeight / 2 },
				{ x: x - prongOffsetX, y: y - handleHeight / 2 - prongHeight / 10},
			];
			const leftOuterProng = Bodies.fromVertices(x - prongOffsetX, y - handleHeight / 2, leftOuterProngVertices, spawn.propsIsNotHoldable);
			if(!tech.pyroSpear) {
				bullet[bullet.length] = leftOuterProng;
				bullet[bullet.length - 1].do = () => {};
			}
			const leftInnerProngVertices = [
				{ x: x - prongOffsetX / 2, y: y - handleHeight / 2 - prongHeight / 1.5 },
				{ x: x - prongOffsetX / 2 - prongWidth / 2, y: y - handleHeight / 2 - prongHeight / 3 },
				{ x: x - prongOffsetX / 2 + prongWidth / 2, y: y - handleHeight / 2 - prongHeight / 3 },
			];
			const leftInnerProng = Bodies.fromVertices(x - prongOffsetX / 2, y - handleHeight / 2, leftInnerProngVertices, spawn.propsIsNotHoldable);
			if(!tech.pyroSpear) {
				bullet[bullet.length] = leftInnerProng;
				bullet[bullet.length - 1].do = () => {};
			}
			const rightOuterProngVertices = [
				{ x: x + prongOffsetX, y: y - handleHeight / 2 - prongHeight },
				{ x: x + prongOffsetX + prongWidth, y: y - handleHeight / 2 - prongHeight / 2 },
				{ x: x + prongOffsetX + prongWidth, y: y - handleHeight / 2 },
				{ x: x + prongOffsetX, y: y - handleHeight / 2  - prongHeight / 10},
			];
			const rightOuterProng = Bodies.fromVertices(x + prongOffsetX, y - handleHeight / 2, rightOuterProngVertices, spawn.propsIsNotHoldable);
			if(!tech.pyroSpear) {
				bullet[bullet.length] = rightOuterProng;
				bullet[bullet.length - 1].do = () => {};
			}
			const rightInnerProngVertices = [
				{ x: x + prongOffsetX / 2, y: y - handleHeight / 2 - prongHeight / 1.5 },
				{ x: x + prongOffsetX / 2 - prongWidth / 2, y: y - handleHeight / 2 - prongHeight / 3 },
				{ x: x + prongOffsetX / 2 + prongWidth / 2, y: y - handleHeight / 2 - prongHeight / 3 },
			];
			const rightInnerProng = Bodies.fromVertices(x + prongOffsetX / 2, y - handleHeight / 2, rightInnerProngVertices, spawn.propsIsNotHoldable);
			if(!tech.pyroSpear) {
				bullet[bullet.length] = rightInnerProng;
				bullet[bullet.length - 1].do = () => {};
			}
			const middleSmallProngVertices = [
				{ x: x, y: y - handleHeight / 2 - prongHeight / 2 },
				{ x: x - prongWidth / 2, y: y - handleHeight / 2 - prongHeight / 3 },
				{ x: x + prongWidth / 2, y: y - handleHeight / 2 - prongHeight / 3 },
			];
			const middleSmallProng = Bodies.fromVertices(x, y - handleHeight / 2, middleSmallProngVertices, spawn.propsIsNotHoldable);
			if(!tech.pyroSpear) {
				bullet[bullet.length] = middleSmallProng;
				bullet[bullet.length - 1].do = () => {};
			}
			const spear = Body.create({
				parts: [handle, pommel, leftOuterProng, leftInnerProng, rightOuterProng, rightInnerProng, middleSmallProng],
			});

			Composite.add(engine.world, spear);
			Matter.Body.setAngle(spear, -m.angle - Math.PI / 2);
			Matter.Body.setPosition(spear, { 
				x: x, 
				y: y
			});
			Matter.Body.setVelocity(spear, { 
				x: 0, 
				y: 0
			});
			spear.collisionFilter.category = cat.bullet;
			spear.collisionFilter.mask = cat.mobBullet | cat.powerup | cat.mob | cat.body;
			Body.scale(spear, -1, 1, { x, y });
			if(!tech.pyroSpear) {
				return { spear, bladeSegments: [leftOuterProng, leftInnerProng, rightOuterProng, rightInnerProng, middleSmallProng, pommel] };
			} else {
				Body.scale(spear, 1.5, 1.5, { x, y });
				return { spear, bladeSegments: [handle, leftOuterProng, leftInnerProng, rightOuterProng, rightInnerProng, middleSmallProng, pommel] };
			}
        },
		renderDefault() {
			if(this.spear) {
				for (let i = 0; i < this.bladeSegments.length; i++) {
					const blade = this.bladeSegments[i];
					const trail = this.bladeTrails[i] || [];
					const vertices = blade.vertices.map(vertex => ({ x: vertex.x, y: vertex.y }));
					trail.push(vertices);
					if (trail.length > 10) {
						trail.shift();
					}
					this.bladeTrails[i] = trail;
				}
				for (let i = 0; i < this.bladeTrails.length; i++) {
					const trail = this.bladeTrails[i];
	
					const alphaStep = 1 / trail.length;
					let alpha = 0;
	
					for (let j = 0; j < trail.length; j++) {
						const vertices = trail[j];
						ctx.beginPath();
						ctx.moveTo(vertices[0].x, vertices[0].y);
	
						for (let k = 1; k < vertices.length; k++) {
							ctx.lineTo(vertices[k].x, vertices[k].y);
						};
	
						alpha += alphaStep;
						ctx.closePath();
						if(tech.isEnergyHealth) {
							const eyeColor = m.fieldMeterColor;    
							const r = eyeColor[1];
							const g = eyeColor[2];
							const b = eyeColor[3];
							const color = `#${r}${r}${g}${g}${b}${b}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
							ctx.fillStyle = color;
						} else {
							ctx.fillStyle = `rgba(220, 20, 60, ${alpha})`;
						}
						ctx.fill();
					}
				}
				for(let i = 0; i < this.bladeSegments.length; i++) {
					ctx.beginPath();
					ctx.lineJoin = "miter";
					ctx.miterLimit = 100;
					ctx.strokeStyle = tech.isEnergyHealth ? m.fieldMeterColor : "crimson";
					ctx.lineWidth = 5;
					ctx.fillStyle = "black";
					ctx.moveTo(this.bladeSegments[i].vertices[0].x, this.bladeSegments[i].vertices[0].y);
					for(let j = 0; j < this.bladeSegments[i].vertices.length; j++) {
						ctx.lineTo(this.bladeSegments[i].vertices[j].x, this.bladeSegments[i].vertices[j].y)
					};
					ctx.closePath();
					ctx.stroke();
					ctx.fill();
					ctx.lineJoin = "round";
					ctx.miterLimit = 10;
				}
			}
		},
		renderLightning() {
			if(this.spear) {
				let shock = 20;
				for (let i = 0; i < this.bladeSegments.length; i++) {
					const blade = this.bladeSegments[i];
					const trail = this.bladeTrails[i] || [];
					const vertices = blade.vertices.map(vertex => ({ x: vertex.x, y: vertex.y }));
					trail.push(vertices);
					if (trail.length > 10) {
						trail.shift();
					}
					this.bladeTrails[i] = trail;
				}
				for (let i = 0; i < this.bladeTrails.length; i++) {
					const trail = this.bladeTrails[i];
					const alphaStep = 1 / trail.length;
					let alpha = 0;
					for (let j = 0; j < trail.length; j++) {
						const vertices = trail[j];
						ctx.lineWidth = 3;
						ctx.beginPath();
						ctx.moveTo(vertices[0].x + shock * Math.random() - shock * Math.random(), vertices[0].y + shock * Math.random() - shock * Math.random());
						for (let k = 1; k < vertices.length; k++) {
							ctx.lineTo(vertices[k].x + shock * Math.random() - shock * Math.random(), vertices[k].y + shock * Math.random() - shock * Math.random());
						};
						alpha += alphaStep;
						ctx.closePath();
						ctx.strokeStyle = `rgba(220, 20, 220, ${alpha})`;
						ctx.fillStyle = `rgba(250, 250, 250, ${alpha})`;
						ctx.fill();
						ctx.stroke();
					}
				}
				for(let i = 0; i < this.bladeSegments.length; i++) {
					ctx.beginPath();
					ctx.lineJoin = "miter";
					ctx.miterLimit = 100;
					ctx.strokeStyle = tech.isEnergyHealth ? m.fieldMeterColor : "rgb(220, 20, 220)";
					ctx.lineWidth = 10;
					ctx.fillStyle = "white";
					ctx.moveTo(this.bladeSegments[i].vertices[0].x + shock * Math.random() - shock * Math.random(), this.bladeSegments[i].vertices[0].y + shock * Math.random() - shock * Math.random());
					for(let j = 0; j < this.bladeSegments[i].vertices.length; j++) {
						ctx.lineTo(this.bladeSegments[i].vertices[j].x + shock * Math.random() - shock * Math.random(), this.bladeSegments[i].vertices[j].y + shock * Math.random() - shock * Math.random())
					};
					ctx.closePath();
					ctx.stroke();
					ctx.fill();
					ctx.lineJoin = "round";
					ctx.miterLimit = 10;
				}
				for(let i = 0; i < this.bladeSegments.length - 1; i++) {
					this.lightning(this.bladeSegments[i].position.x, this.bladeSegments[i].position.y, this.bladeSegments[i + 1].position.x, this.bladeSegments[i + 1].position.y)
				}
			}
		},
		renderFlame() {
			if (this.spear) {
				for (let i = 0; i < this.bladeSegments.length; i++) {
					const blade = this.bladeSegments[i];
					const trail = this.bladeTrails[i] || [];
					const vertices = blade.vertices.map(vertex => ({ x: vertex.x, y: vertex.y }));
					trail.push(vertices);
					if (trail.length > 10) {
						trail.shift();
					}
					this.bladeTrails[i] = trail;
				}

				for (let i = 0; i < this.bladeTrails.length; i++) {
					const trail = this.bladeTrails[i];
					const alphaStep = 1 / trail.length;
					let alpha = 0;

					for (let j = 0; j < trail.length; j++) {
						const vertices = trail[j];
						ctx.beginPath();
						const offx = Math.sin((j) * 0.3 * Math.abs(Math.sin(simulation.cycle / 1000)) + simulation.cycle * 0.08) * 25;
						const offy = Math.sin((j) * 0.5 * Math.abs(Math.sin(simulation.cycle / 1000)) + simulation.cycle * 0.08) * 25;
						ctx.moveTo(vertices[0].x + offx, vertices[0].y + offy);
						for (let k = 1; k < vertices.length; k++) {
							const offsetX = Math.sin((j + k) * 0.3 * Math.abs(Math.sin(simulation.cycle / 1000)) + simulation.cycle * 0.08) * 25;
							const offsetY = Math.sin((j + k) * 0.5 * Math.abs(Math.sin(simulation.cycle / 1000)) + simulation.cycle * 0.08) * 25;
							ctx.lineTo(vertices[k].x + offsetX, vertices[k].y + offsetY);
						}

						alpha += alphaStep;
						ctx.closePath();

						ctx.fillStyle = `rgba(${255 + j * 10}, ${90 + j * 5}, ${75 + j * 15}, ${alpha})`;
						ctx.fill();
					}
				}
				const gradient = ctx.createRadialGradient(
					this.bladeSegments[0].vertices[0].x, 
					this.bladeSegments[0].vertices[0].y, 
					0,
					this.bladeSegments[0].vertices[0].x, 
					this.bladeSegments[0].vertices[0].y, 
					Math.abs(Math.sin(simulation.cycle / 30)) * 1000
				);
				for (let i = 0; i < this.bladeSegments.length; i++) {
					ctx.save()
					ctx.beginPath();
					ctx.lineJoin = "miter";
					ctx.miterLimit = 100;
					ctx.globalCompositeOperation = "overlay";
					ctx.filter = "blur(3px)"

					gradient.addColorStop(0, `rgba(255, 69, ${Math.abs(Math.sin(simulation.cycle / 30)) * 255}, 0.8)`); // Inner color
					// gradient.addColorStop(0.5, `rgba(255, 255, 255, 0.4)`);
					gradient.addColorStop(1, `rgba(255, 0, 0, 0.4)`); // Outer color (can adjust this as needed)

					// ctx.strokeStyle = gradient;
					ctx.lineWidth = 5;

					ctx.moveTo(this.bladeSegments[i].vertices[0].x, this.bladeSegments[i].vertices[0].y);

					for (let j = 1; j < this.bladeSegments[i].vertices.length; j++) {
						ctx.lineTo(this.bladeSegments[i].vertices[j].x, this.bladeSegments[i].vertices[j].y);
					}

					ctx.closePath();
					
					ctx.fillStyle = gradient;
					ctx.fill();
					// ctx.stroke();

					ctx.lineJoin = "round";
					ctx.miterLimit = 10;
					ctx.restore();
				}
			}
		},
		lightning(x1, y1, x2, y2, strokeColor = 'rgb(220, 20, 220)', lineWidth = 5) {
			ctx.strokeStyle = strokeColor;
			ctx.lineWidth = lineWidth;
			const dx = x2 - x1;
			const dy = y2 - y1;
			const distance = Math.sqrt(dx * dx + dy * dy);
			const angle = Math.atan2(dy, dx);
			const boltCount = Math.floor(Math.random() * 3) + 1;
			for (let i = 0; i < boltCount; i++) {
				let currentX = x1;
				let currentY = y1;
				ctx.beginPath();
				ctx.moveTo(currentX, currentY);
				while (Math.hypot(currentX - x1, currentY - y1) < distance) {
					const segmentLength = Math.random() * 10 + 5;
					const offsetAngle = angle + (Math.random() - 0.5) * 0.4;
					const nextX = currentX + Math.cos(offsetAngle) * segmentLength;
					const nextY = currentY + Math.sin(offsetAngle) * segmentLength;
					if (Math.hypot(nextX - x1, nextY - y1) >= distance) break;
					ctx.lineTo(nextX, nextY);
					currentX = nextX;
					currentY = nextY;
				}
				ctx.lineTo(x2, y2);
				ctx.stroke();
			}
		},
		collision() {
			if(this.spear) {
				for (let i = 0; i < mob.length; i++) {
					if (Matter.Query.collides(this.spear, [mob[i]]).length > 0) {
						const dmg = Math.sqrt(m.dmgScale * Math.sqrt(this.spear.speed)) * (tech.spearEye ? (m.health > 0.01 ? 3 : 1) : 1);
						mob[i].damage(dmg, true);
						simulation.drawList.push({
							x: mob[i].position.x,
							y: mob[i].position.y,
							radius: Math.abs(Math.log(dmg * this.spear.speed) * 40 * mob[i].damageReduction + 3),
							color: simulation.mobDmgColor,
							time: simulation.drawTime
						});
						if(tech.shockSpear) {
							mobs.statusStun(mob[i], 10);
						}
						if(this.durability > 0) {
							this.durability--;
						}
						break
					}
				}
			}
		},
		drawDurability(bgColor = "rgba(0, 0, 0, 0.4)") {
			ctx.lineWidth = 4;
			ctx.beginPath();
			ctx.strokeStyle = bgColor;
			ctx.arc(m.pos.x, m.pos.y, 35, 0, 2 * Math.PI);
			ctx.stroke();
			
			ctx.beginPath();
			ctx.strokeStyle = "#467";
			ctx.arc(m.pos.x, m.pos.y, 35, 0, 2 * Math.PI * (this.durability / this.maxDurability));
			ctx.stroke();
		},
	};
	b.guns.push(e);
	const gunArray = b.guns.filter(
	(obj, index, self) =>
		index === self.findIndex((item) => item.name === obj.name)
	);
	b.guns = gunArray;
	const t = [
		{
			name: "protoporphyrin IX",
			descriptionFunction() {
				return `<b class="color-h">health</b> is converted to <b>spear</b> <em>durability</em><br>when spear <em>durability</em> reaches 0`
			},
			isGunTech: true,
			maxCount: 1,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() {
				return tech.haveGunCheck("spear")
			},
			requires: "spear",
			effect() {
				tech.protoporphyrin = true;
				simulation.ephemera.push({
					name: "healthSpear",
					do() {
						for (let i = 0, len = b.inventory.length; i < len; ++i) {
							if(b.guns[b.inventory[i]].name === "spear" && b.guns[b.inventory[i]].durability == 0) {
								if(tech.isEnergyHealth) {
									m.energy -= 0.1;
									b.guns[b.inventory[i]].durability += 100;
								} else {
									m.health -= 0.1;
									b.guns[b.inventory[i]].durability += 100;
									m.displayHealth();
								}
							}
						}
					}
				})
			},
			remove() {
				tech.protoporphyrin = false;
				simulation.removeEphemera("healthSpear");
			}
		},		
		{
			name: "tempering",
			descriptionFunction() {
				return `+100 spear <em>durability</em><br>-1 <em>durability</em> per ${powerUps.orb.ammo()}`
			},
			isGunTech: true,
			maxCount: 9,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() {
				return tech.haveGunCheck("spear")
			},
			requires: "spear",
			effect() {
				tech.tempering = this.count;
				for (let i = 0, len = b.inventory.length; i < len; ++i) {
					if(b.guns[b.inventory[i]].name === "spear") {
						b.guns[b.inventory[i]].maxDurability += 100;
					}
				}
			},
			remove() { //reset code here because it doesn't work anywhere else :/
				tech.tempering = this.count; 
				for (let i = 0, len = b.inventory.length; i < len; ++i) {
					if(b.guns[b.inventory[i]].name === "spear" && b.guns[b.inventory[i]].maxDurability > 300) {
						b.guns[b.inventory[i]].maxDurability -= 100;
					} else {
						if(b.guns[b.inventory[i]].name === "spear" && !m.alive) {
							b.guns[b.inventory[i]].cycle = 0;
							b.guns[b.inventory[i]].haveEphemera = false;
							b.guns[b.inventory[i]].durability = 300;
							b.guns[b.inventory[i]].maxDurability = 300;
						}
					}
				}
			}
		},
		{
			name: "dry lightning",
			descriptionFunction() {
				return `imbue <b>spear</b> with <b style="color: rgb(220, 20, 220);">energy</b><br>mobs are <b class="color-s">stunned</b> by <b>spear</b>`
			},
			isGunTech: true,
			maxCount: 1,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() {
				return tech.haveGunCheck("spear") && !tech.spearEye
			},
			requires: "spear, not blood transfusion",
			effect() {
				tech.shockSpear = true;
			},
			remove() {
				tech.shockSpear = false;
			}
		},		
		{
			name: "arc discharge",
			descriptionFunction() {
				return `spear <b style="color: rgb(220, 20, 220);">lightning</b> may strike nearby mobs<br>increases <b>probability</b> and <b style="color: rgb(220, 20, 220);">energy</b> cost`
			},
			isGunTech: true,
			maxCount: 9,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() {
				return tech.haveGunCheck("spear") && tech.shockSpear
			},
			requires: "spear",
			effect() {
				tech.spearArc = this.count;
			},
			remove() {
				tech.spearArc = this.count;
			}
		},
		{
			name: "polonium-210",
			descriptionFunction() {
				return `gather <b>polonium-210</b> into spear<br>crouching <b>charges</b> a ball of polonium and <b class="color-f">energy</b>`
			},
			isGunTech: true,
			maxCount: 1,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() {
				return tech.haveGunCheck("spear") && tech.shockSpear
			},
			requires: "spear, dry lightning",
			effect() {
				tech.spearRadioactive = true;
				simulation.ephemera.push({
					name: "spearRadioactive",
					radius: 0,
					particles: [],
					maxParticles: 50,
					gatherSpeed: 0.08,
					do() {
						if(!tech.spearRadioactive) {
							simulation.removeEphemera(this.name);
						}
						for (let i = 0, len = b.inventory.length; i < len; ++i) {
							if(b.guns[b.inventory[i]].name === "spear" && b.guns[b.inventory[i]].spear) {
								let spearPos = {
									x: b.guns[b.inventory[i]].bladeSegments[4].vertices[0].x,
									y: b.guns[b.inventory[i]].bladeSegments[4].vertices[0].y
								};
								if(input.down && m.energy > 0) {
									this.radius += 1;
									m.energy -= 0.001;
								} else if(this.radius > 0) {
									let angle = Math.atan2(b.guns[b.inventory[i]].constraint2.pointA.y - b.guns[b.inventory[i]].constraint1.bodyB.position.y, b.guns[b.inventory[i]].constraint2.pointA.x - b.guns[b.inventory[i]].constraint1.bodyB.position.x);
								
									const range = {
										x: 5000 * Math.cos(angle),
										y: 5000 * Math.sin(angle)
									}
									const rangeOffPlus = {
										x: 7.5 * Math.cos(angle + Math.PI / 2),
										y: 7.5 * Math.sin(angle + Math.PI / 2)
									}
									const rangeOffMinus = {
										x: 7.5 * Math.cos(angle - Math.PI / 2),
										y: 7.5 * Math.sin(angle - Math.PI / 2)
									}
									const dmg = this.radius * m.dmgScale;
									const where = {
										x: spearPos.x + 30 * Math.cos(angle),
										y: spearPos.y + 30 * Math.sin(angle)
									}
									const eye = {
										x: spearPos.x + 15 * Math.cos(angle),
										y: spearPos.y + 15 * Math.sin(angle)
									}
									if (Matter.Query.ray(map, eye, where).length === 0 && Matter.Query.ray(body, eye, where).length === 0) {
										this.energyBeam(eye, angle, this.radius);
									}
									for (let i = 1; i < 4; i++) {
										let whereOff = Vector.add(where, {
											x: i * rangeOffPlus.x,
											y: i * rangeOffPlus.y
										})
										if (Matter.Query.ray(map, eye, whereOff).length === 0 && Matter.Query.ray(body, eye, whereOff).length === 0) {
											this.energyBeam(eye, angle, this.radius);
										}
										whereOff = Vector.add(where, {
											x: i * rangeOffMinus.x,
											y: i * rangeOffMinus.y
										})
										if (Matter.Query.ray(map, eye, whereOff).length === 0 && Matter.Query.ray(body, eye, whereOff).length === 0) {
											this.energyBeam(eye, angle, this.radius);
										}
									}
									this.radius -= 0.5;
								}
								this.radius = Math.min(75 + 15 * Math.random(), Math.max(0, this.radius));
								if (this.particles.length < this.maxParticles && input.down) {
									const angle = Math.random() * 2 * Math.PI;
									const distance = this.radius + Math.random() * 500;
									const offsetX = Math.cos(angle) * distance;
									const offsetY = Math.sin(angle) * distance;
									this.particles.push({
										position: { x: offsetX, y: offsetY },
										prevPosition: { x: offsetX, y: offsetY },
										speed: 0.5 + Math.random() * 0.5
									});
								}
								ctx.save();
								ctx.globalAlpha = 1;
								ctx.translate(spearPos.x, spearPos.y);
								ctx.beginPath();
								ctx.strokeStyle = "transparent";
								const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
								const alpha = 0.8 + 0.1 * Math.random();
								gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
								gradient.addColorStop(0.35 + 0.1 * Math.random(), `rgba(255,150,255,${alpha})`);
								gradient.addColorStop(1, `rgba(255,0,255,${alpha})`);
								// gradient.addColorStop(1, `rgba(255,150,255,${alpha})`);
								ctx.fillStyle = gradient
								ctx.arc(0, 0, this.radius, 0, 2 * Math.PI);
								ctx.stroke();
								ctx.fill();
								ctx.lineWidth = 1000;
								for(let i = 0; i < 4; i++) {
									const angle = Math.random() * 2 * Math.PI
									const Dx = Math.cos(angle);
									const Dy = Math.sin(angle);
									let xElec = 40 * Dx;
									let yElec = 40 * Dy;
									ctx.beginPath();
									ctx.moveTo(xElec, yElec);
									const step = 40
									for (let i = 0; i < 3; i++) {
										xElec += step * (Dx + 1.5 * (Math.random() - 0.5))
										yElec += step * (Dy + 1.5 * (Math.random() - 0.5))
										ctx.lineTo(xElec, yElec);
									}
									ctx.stroke();
								}
								ctx.restore();
								this.particles.forEach((particle, index) => {
									ctx.globalAlpha = 1;
									if (particle.trailLife === undefined) {
										particle.trailLife = 0;
										particle.maxTrailLife = 125;
									}

									const dx = -particle.position.x * this.gatherSpeed * particle.speed;
									const dy = -particle.position.y * this.gatherSpeed * particle.speed;

									particle.prevPosition.x = particle.position.x;
									particle.prevPosition.y = particle.position.y;

									particle.position.x += dx;
									particle.position.y += dy;

									particle.trailLife = Math.min(particle.maxTrailLife, particle.trailLife + 1);
									if (particle.trailLife >= particle.maxTrailLife) particle.trailLife -= 2;

									const trailLength = (particle.trailLife / particle.maxTrailLife) * 300 * (1 - Math.abs(particle.trailLife - particle.maxTrailLife / 2) / (particle.maxTrailLife / 2));

									const trailEndX = spearPos.x + particle.position.x - dx * trailLength;
									const trailEndY = spearPos.y + particle.position.y - dy * trailLength;

									ctx.beginPath();
									ctx.moveTo(trailEndX, trailEndY);
									ctx.lineTo(spearPos.x + particle.position.x, spearPos.y + particle.position.y);
									ctx.strokeStyle = `rgba(220, 20, 220, 0.8)`;
									ctx.lineWidth = 6;
									ctx.stroke();

									ctx.beginPath();
									ctx.moveTo(trailEndX, trailEndY);
									ctx.lineTo(spearPos.x + particle.position.x, spearPos.y + particle.position.y);
									ctx.strokeStyle = `#FFFFFF`;
									ctx.lineWidth = 3;
									ctx.stroke();

									const distanceSquared = particle.position.x * particle.position.x + particle.position.y * particle.position.y;
									if (distanceSquared < 1) {
										this.particles.splice(index, 1);
									}
								});
							}
						}
					},
					energyBeam(where, angle, charge) {
						let best;
						let range = 5000;
						const path = [
							{
								x: where.x + 20 * Math.cos(angle),
								y: where.y + 20 * Math.sin(angle)
							},
							{
								x: where.x + range * Math.cos(angle),
								y: where.y + range * Math.sin(angle)
							}
						];

						best = {
							x: null,
							y: null,
							dist2: Infinity,
							who: null,
							v1: null,
							v2: null
						};
						if (!best.who) {
							best = vertexCollision(path[0], path[1], [mob, map, body]);
							if (best.dist2 != Infinity) {
								path[path.length - 1] = {
									x: best.x,
									y: best.y
								};
							}
						}
						if (best.dist2 !== Infinity) {
							path[path.length - 1] = { x: best.x, y: best.y };
							if (best.who.alive) {
								best.who.locatePlayer();
								if (best.who.damageReduction) {
									best.who.damage(charge * 0.005 * m.dmgScale);
								}
							}
						}
						ctx.beginPath();
						ctx.moveTo(path[0].x, path[0].y);
						ctx.lineTo(path[1].x, path[1].y);

						ctx.strokeStyle = "rgba(220,0,220,0.01)";
						ctx.lineWidth = 50;
						ctx.stroke();
						
						ctx.beginPath();
						ctx.moveTo(path[0].x, path[0].y);
						ctx.lineTo(path[1].x, path[1].y);

						ctx.strokeStyle = "rgba(220,0,220,0.05)";
						ctx.lineWidth = 35;
						ctx.stroke();
						
						ctx.beginPath();
						ctx.moveTo(path[0].x, path[0].y);
						ctx.lineTo(path[1].x, path[1].y);

						ctx.strokeStyle = "rgba(220,220,220,0.9)";
						ctx.lineWidth = 17;
						ctx.stroke();
						
						this.lightning(path[0].x, path[0].y, path[1].x, path[1].y);
					},
					lightning(x1, y1, x2, y2, strokeColor = 'rgb(220, 20, 220)', lineWidth = 5) {
						ctx.strokeStyle = strokeColor;
						ctx.lineWidth = lineWidth;
						const dx = x2 - x1;
						const dy = y2 - y1;
						const distance = Math.sqrt(dx * dx + dy * dy);
						const angle = Math.atan2(dy, dx);
						const boltCount = Math.floor(Math.random() * 3) + 1;
						for (let i = 0; i < boltCount; i++) {
							let currentX = x1;
							let currentY = y1;
							ctx.beginPath();
							ctx.moveTo(currentX, currentY);
							while (Math.hypot(currentX - x1, currentY - y1) < distance) {
								const segmentLength = Math.random() * 10 + 5;
								const offsetAngle = angle + (Math.random() - 0.5) * 0.4;
								const nextX = currentX + Math.cos(offsetAngle) * segmentLength;
								const nextY = currentY + Math.sin(offsetAngle) * segmentLength;
								if (Math.hypot(nextX - x1, nextY - y1) >= distance) break;
								ctx.lineTo(nextX, nextY);
								currentX = nextX;
								currentY = nextY;
							}
							ctx.lineTo(x2, y2);
							ctx.stroke();
						}
					},
				})
			},
			remove() {
				tech.spearRadioactive = false;
			}
		},
		{
			name: "blood transfusion",
			descriptionFunction() {
				return `sacrifice <b class="color-h">health</b> onto your spear<br>-6 <b class="color-h">health</b>/second but <b>3x</b> spear <b class="color-d">damage</b>`
			},
			isGunTech: true,
			maxCount: 1,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() {
				return tech.haveGunCheck("spear") && !tech.isEnergyHealth && !tech.shockSpear
			},
			requires: "spear, not mass energy or dry lightning",
			effect() {
				tech.spearEye = true;
				simulation.ephemera.push({
					name: "eyeSpear",
					eyeCount: undefined,
					do() {
						if(!tech.spearEye) {
							simulation.removeEphemera(this.name);
						}
						for (let i = 0, len = b.inventory.length; i < len; ++i) {
							if(b.guns[b.inventory[i]].name === "spear" && b.guns[b.inventory[i]].spear) {
								if(m.health > 0.01) {
									m.health -= (tech.spearHeart ? 0.0001 : 0.001);
									m.displayHealth();
									if(tech.spearHeart && Math.random() < 0.005) {
										m.energy -= 0.1;
									}
								} else {
									break;
								}
								let spearPos = {
									x: b.guns[b.inventory[i]].bladeSegments[4].vertices[0].x,
									y: b.guns[b.inventory[i]].bladeSegments[4].vertices[0].y
								};
								ctx.save();
								const eyeCount = 3;
								const radius = 3000;
								const lerpSpeed = 0.05;
								if (!this.eyePositions) {
									this.eyePositions = Array(eyeCount).fill({ x: spearPos.x, y: spearPos.y });
								}
								for (let j = 0; j < eyeCount; j++) {
									const targetAngle = (j * (2 * Math.PI)) / eyeCount + performance.now() * 0.001;
									const targetX = spearPos.x + Math.cos(targetAngle) * radius;
									const targetY = spearPos.y + Math.sin(targetAngle) * radius;
									const currentPos = this.eyePositions[j];
									currentPos.x += (targetX - currentPos.x) * lerpSpeed;
									currentPos.y += (targetY - currentPos.y) * lerpSpeed;
									const angleToSpear = Math.atan2(spearPos.y - currentPos.y, spearPos.x - currentPos.x);
									ctx.save();
									ctx.translate(currentPos.x, currentPos.y);
									ctx.rotate(angleToSpear);
									ctx.beginPath();
									ctx.arc(0, 0, 10, 0, 2 * Math.PI);
									ctx.strokeStyle = "crimson";
									ctx.fillStyle = "crimson";
									ctx.stroke();
									ctx.fill();
									ctx.beginPath();
									ctx.moveTo(-25, 0);
									ctx.quadraticCurveTo(0, -20, 25, 0);
									ctx.moveTo(-25, 0);
									ctx.quadraticCurveTo(0, 20, 25, 0);
									ctx.strokeStyle = "crimson";
									ctx.lineWidth = 2;
									ctx.stroke();
									ctx.restore();
								}

								ctx.restore();
							}
						}
					}
				})
			},
			remove() {
				tech.spearEye = false;
			}
		},		
		{
			name: "heart meridian",
			descriptionFunction() {
				return `reduce <b class="color-h">health</b> drain by <b>10x</b><br><b class="color-f">energy</b> will randomly drain`
			},
			isGunTech: true,
			maxCount: 1,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() {
				return tech.haveGunCheck("spear") && tech.spearEye
			},
			requires: "spear, blood transfusion",
			effect() {
				tech.spearHeart = true;
			},
			remove() {
				tech.spearHeart = false;
			}
		},		
		{
			name: "pyroflux",
			descriptionFunction() {
				return `<b>1.5x</b> spear <b>size</b><br><b class="color-d">damage</b> nearby mobs`
			},
			isGunTech: true,
			maxCount: 1,
			count: 0,
			frequency: 2,
			frequencyDefault: 2,
			allowed() {
				return tech.haveGunCheck("spear") && !tech.spearEye && ! tech.shockSpear
			},
			requires: "spear, not blood transfusion, dry lightning",
			effect() {
				tech.pyroSpear = true;
			},
			remove() {
				tech.pyroSpear = false;
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
	const techArray = tech.tech.filter(
		(obj, index, self) =>
			index === self.findIndex((item) => item.name === obj.name)
		);
	tech.tech = techArray;
	console.log("%cSpear mod successfully installed", "color: crimson");
})();
