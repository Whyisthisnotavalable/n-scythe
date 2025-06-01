javascript:(function(){
    let addBot = {
        harpoonBot(position = { x: player.position.x + 50 * (Math.random() - 0.5), y: player.position.y + 50 * (Math.random() - 0.5) }, isKeep = true) {
            const me = bullet.length;
            const dir = m.angle;
            const RADIUS = (12 + 4 * Math.random())
            bullet[me] = Bodies.polygon(position.x, position.y, 6, RADIUS, {
                isUpgraded: tech.isHarpoonBotUpgrade,
                botType: "harpoon",
                angle: dir,
                friction: 0,
                frictionStatic: 0,
                frictionAir: 0.05,
                restitution: 0.6 * (1 + 0.5 * Math.random()),
                dmg: 0, // 0.14   //damage done in addition to the damage from momentum
                minDmgSpeed: 2,
                // lookFrequency: 56 + Math.floor(17 * Math.random()) - isUpgraded * 20,
                lastLookCycle: simulation.cycle + 60 * Math.random(),
                delay: Math.floor((tech.isHarpoonBotUpgrade ? 22 : 85) + 10 * isKeep),
                acceleration: (isKeep ? 0.005 : 0.001) * (1 + 0.5 * Math.random()),
                range: 60 * (1 + 0.3 * Math.random()) + 3 * b.totalBots() + !isKeep * 100,
                endCycle: Infinity,
                classType: "bullet",
                collisionFilter: {
                    category: cat.bullet,
                    mask: b.totalBots() < 50 ? cat.map | cat.body | cat.bullet | cat.mob | cat.mobBullet | cat.mobShield : cat.map | cat.body | cat.mob | cat.mobBullet | cat.mobShield //if over 50 bots, they no longer collide with each other
                },
                beforeDmg() { },
                onEnd() { },
                do() {
                    const distanceToPlayer = Vector.magnitude(Vector.sub(this.position, m.pos))
                    if (distanceToPlayer > this.range) { //if far away move towards player
                        this.force = Vector.mult(Vector.normalise(Vector.sub(m.pos, this.position)), this.mass * this.acceleration)
                    } else { //close to player
                        Matter.Body.setVelocity(this, Vector.add(Vector.mult(this.velocity, 0.90), Vector.mult(player.velocity, 0.17))); //add player's velocity
                        if (this.lastLookCycle < simulation.cycle && !m.isCloak && m.energy > 0.1) {
                            this.lastLookCycle = simulation.cycle + this.delay
                            let shot = false;
                            for (let i = 0, len = mob.length; i < len; i++) {
                                const dist = Vector.magnitudeSquared(Vector.sub(this.position, mob[i].position));
                                if (
                                    !mob[i].isBadTarget &&
                                    dist < 300000 &&
                                    Matter.Query.ray(map, this.position, mob[i].position).length === 0 &&
                                    Matter.Query.ray(body, this.position, mob[i].position).length === 0 &&
                                    !mob[i].isShielded &&
                                    !mob[i].isInvulnerable &&
                                    !shot
                                ) {
                                    const angle = Math.atan2(mob[i].position.y - this.position.y, mob[i].position.x - this.position.x)
                                    const unit = Vector.normalise(Vector.sub(Vector.add(mob[i].position, Vector.mult(mob[i].velocity, Math.sqrt(dist) / 60)), this.position))
                                    if (this.isUpgraded) {
                                        b.botHarpoon(this.position, mob[i], angle, 1, true, 15, false, 0.12, this)
                                        this.force = Vector.mult(unit, -0.02 * this.mass)
                                    } else {
                                        b.botHarpoon(this.position, mob[i], angle, 1, true, 10, false, 0.08, this)
                                        this.force = Vector.mult(unit, -0.012 * this.mass)
                                    }
                                    shot = true;
                                    break;
                                }
                            }
                            for (let i = 0, len = powerUp.length; i < len; i++) {
                                const dist = Vector.magnitudeSquared(Vector.sub(this.position, powerUp[i].position));
                                if (
                                    dist < 300000 &&
                                    Matter.Query.ray(map, this.position, powerUp[i].position).length === 0 &&
                                    Matter.Query.ray(body, this.position, powerUp[i].position).length === 0 &&
                                    !(powerUp[i].name == "heal" && m.health == m.maxHealth) &&
                                    !shot
                                ) {
                                    const angle = Math.atan2(powerUp[i].position.y - this.position.y, powerUp[i].position.x - this.position.x)
                                    const unit = Vector.normalise(Vector.sub(Vector.add(powerUp[i].position, Vector.mult(powerUp[i].velocity, Math.sqrt(dist) / 60)), this.position))
                                    if (this.isUpgraded) {
                                        b.botHarpoon(this.position, powerUp[i], angle, 1, true, 15, false, 0.2, this)
                                        this.force = Vector.mult(unit, -0.02 * this.mass)
                                    } else {
                                        b.botHarpoon(this.position, powerUp[i], angle, 1, true, 10, false, 0.08, this)
                                        this.force = Vector.mult(unit, -0.012 * this.mass)
                                    }
                                    shot = true;
                                    break;
                                }
                            }
                        }
                    }
                }
            })
            Composite.add(engine.world, bullet[me]); //add bullet to world
        },
        botHarpoon(where, target, angle = m.angle, harpoonSize = 1, isReturn = false, totalCycles = 35, isReturnAmmo = true, thrust = 0.1, bot) {
            const me = bullet.length;
            const returnRadius = 100 * Math.sqrt(harpoonSize)
            let shape
            if (tech.isRebar) {
                const long = tech.isMaul ? 32 : 65
                const tall = tech.isMaul ? 25 : 5
                shape = [{
                    x: -long * harpoonSize,
                    y: tall * harpoonSize,
                    index: 0,
                    isInternal: false
                }, {
                    x: -long * harpoonSize * 1.05,
                    y: 0,
                    index: 1,
                    isInternal: false
                }, {
                    x: -long * harpoonSize,
                    y: -tall * harpoonSize,
                    index: 2,
                    isInternal: false
                }, {
                    x: long * harpoonSize,
                    y: -tall * harpoonSize,
                    index: 3,
                    isInternal: false
                }, {
                    x: long * harpoonSize * 1.05,
                    y: 0,
                    index: 4,
                    isInternal: false
                }, {
                    x: long * harpoonSize,
                    y: tall * harpoonSize,
                    index: 5,
                    isInternal: false
                }]
            } else {
                shape = [{
                    x: -40 * harpoonSize,
                    y: 2 * harpoonSize,
                    index: 0,
                    isInternal: false
                }, {
                    x: -40 * harpoonSize,
                    y: -2 * harpoonSize,
                    index: 1,
                    isInternal: false
                }, {
                    x: 50 * harpoonSize,
                    y: -3 * harpoonSize,
                    index: 3,
                    isInternal: false
                }, {
                    x: 30 * harpoonSize,
                    y: 2 * harpoonSize,
                    index: 4,
                    isInternal: false
                }]
            }


            bullet[me] = Bodies.fromVertices(where.x, where.y, shape, {
                cycle: 0,
                angle: angle,
                friction: 1,
                frictionAir: 0.4,
                // thrustMag: 0.1,
                drain: tech.isRailEnergy ? 0.0002 : 0.006,
                turnRate: isReturn ? 0.1 : 0.03, //0.015
                drawStringControlMagnitude: 3000 + 5000 * Math.random(),
                drawStringFlip: (Math.round(Math.random()) ? 1 : -1),
                dmg: 6, //damage done in addition to the damage from momentum
                classType: "bullet",
                endCycle: simulation.cycle + totalCycles * 2.5 + 40,
                collisionFilter: {
                    category: cat.bullet,
                    mask: tech.isShieldPierce ? cat.map | cat.body | cat.mob | cat.mobBullet : cat.map | cat.body | cat.mob | cat.mobBullet | cat.mobShield,
                },
                minDmgSpeed: 4,
                lookFrequency: Math.floor(7 + Math.random() * 3),
                density: tech.harpoonDensity * (tech.isRebar ? 0.6 : 1), //0.001 is normal for blocks,  0.004 is normal for harpoon,  0.004*6 when buffed
                foamSpawned: 0,
                beforeDmg(who) {
                    if (tech.isShieldPierce && who.isShielded) { //disable shields
                        who.isShielded = false
                        requestAnimationFrame(() => {
                            who.isShielded = true
                        });
                    }
                    if (tech.fragments) {
                        b.targetedNail(this.vertices[2], tech.fragments * Math.floor(2 + Math.random()))
                        if (!isReturn) this.endCycle = 0;
                    }
                    if (!who.isBadTarget) {
                        if (isReturn) {
                            this.do = this.returnToPlayer
                        } else {
                            this.frictionAir = 0.01
                            this.do = () => {
                                this.force.y += this.mass * 0.003; //gravity
                                this.draw();
                            }
                        }
                    }
                    if (tech.isFoamBall && this.foamSpawned < 55) {
                        for (let i = 0, len = Math.min(30, 2 + 3 * Math.sqrt(this.mass)); i < len; i++) {
                            const radius = 5 + 9 * Math.random()
                            const velocity = { x: Math.max(0.5, 2 - radius * 0.1), y: 0 }
                            b.foam(this.position, Vector.rotate(velocity, 6.28 * Math.random()), radius)
                            this.foamSpawned++
                        }
                    }
                    if (tech.isHarpoonPowerUp && simulation.cycle - 480 < tech.harpoonPowerUpCycle) {
                        Matter.Body.setDensity(this, 1.8 * tech.harpoonDensity); //+90% damage after pick up power up for 8 seconds
                    } else if (tech.isHarpoonFullHealth && who.health === 1) {
                        Matter.Body.setDensity(this, 2.2 * tech.harpoonDensity); //+90% damage if mob has full health do
                        simulation.ephemera.push({
                            name: "harpoon outline",
                            count: 2, //cycles before it self removes
                            vertices: this.vertices,
                            do() {
                                this.count--
                                if (this.count < 0) simulation.removeEphemera(this.name)

                                ctx.beginPath();
                                ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
                                for (let j = 1, len = this.vertices.length; j < len; j += 1) ctx.lineTo(this.vertices[j].x, this.vertices[j].y);
                                ctx.lineTo(this.vertices[0].x, this.vertices[0].y);
                                ctx.lineJoin = "miter"
                                ctx.miterLimit = 20;
                                ctx.lineWidth = 40;
                                ctx.strokeStyle = "rgba(255,0,100,0.35)";
                                ctx.stroke();
                                ctx.lineWidth = 10;
                                ctx.strokeStyle = `#f07`;
                                ctx.stroke();
                                ctx.lineJoin = "round"
                                ctx.miterLimit = 5
                                ctx.fillStyle = "#000"
                                ctx.fill();
                            },
                        })
                    }
                    if (tech.isBreakHarpoon && Math.random() < 0.1) {
                        if (tech.isBreakHarpoonGain) {
                            powerUps.spawn(m.pos.x, m.pos.y - 50, "research");
                            powerUps.spawn(m.pos.x - 20, m.pos.y + 15, "research");
                            powerUps.spawn(m.pos.x + 20, m.pos.y + 15, "boost");
                            b.targetedNail(this.position, Math.floor(1 + 1.5 * Math.random()))
                        }
                        this.endCycle += 60 //so it lasts a bit longer
                        this.frictionAir = 0.01
                        //add spin
                        Matter.Body.setAngularVelocity(this, 0.7 * (Math.random() - 0.5))
                        //cap speed
                        const unit = Vector.normalise(this.velocity)
                        Matter.Body.setVelocity(this, Vector.mult(unit, Math.min(this.speed, 20)));
                        //stop behavior
                        this.do = () => {
                            this.force.y += this.mass * 0.005; //gravity
                        }
                    }
                },
                caughtPowerUp: null,
                dropCaughtPowerUp() {
                    if (this.caughtPowerUp) {
                        this.caughtPowerUp.collisionFilter.category = cat.powerUp
                        this.caughtPowerUp.collisionFilter.mask = cat.map | cat.powerUp
                        this.caughtPowerUp = null
                    }
                },
                onEnd() {
                    if (this.caughtPowerUp && !simulation.isChoosing && (this.caughtPowerUp.name !== "heal" || m.health !== m.maxHealth || tech.isOverHeal)) {
                        let index = null //find index
                        for (let i = 0, len = powerUp.length; i < len; ++i) {
                            if (powerUp[i] === this.caughtPowerUp) index = i
                        }
                        if (index !== null) {
                            powerUps.onPickUp(this.caughtPowerUp);
                            this.caughtPowerUp.effect();
                            Matter.Composite.remove(engine.world, this.caughtPowerUp);
                            powerUp.splice(index, 1);
                            if (tech.isHarpoonPowerUp) tech.harpoonPowerUpCycle = simulation.cycle
                        } else {
                            this.dropCaughtPowerUp()
                        }
                    } else {
                        this.dropCaughtPowerUp()
                    }
                },
                drawDamageAura() {
                    ctx.beginPath();
                    ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
                    for (let j = 1, len = this.vertices.length; j < len; j += 1) ctx.lineTo(this.vertices[j].x, this.vertices[j].y);
                    ctx.lineTo(this.vertices[0].x, this.vertices[0].y);
                    ctx.lineJoin = "miter"
                    ctx.miterLimit = 20;
                    ctx.lineWidth = 15;
                    ctx.strokeStyle = "rgba(255,0,100,0.25)";
                    ctx.stroke();
                    ctx.lineWidth = 4;
                    ctx.strokeStyle = `#f07`;
                    ctx.stroke();
                    ctx.lineJoin = "round"
                    ctx.miterLimit = 5
                    ctx.fillStyle = "#000"
                    ctx.fill();
                },
                drawString() {
                    ropeIndex = this.vertices.length - 1
                    const where = { x: bot.position.x, y: bot.position.y }
                    const sub = Vector.sub(where, this.vertices[ropeIndex])
                    const perpendicular = Vector.mult(Vector.normalise(Vector.perp(sub)), this.drawStringFlip * Math.min(80, 10 + this.drawStringControlMagnitude / (10 + Vector.magnitude(sub))))
                    const controlPoint = Vector.add(Vector.add(where, Vector.mult(sub, -0.5)), perpendicular)
                    ctx.strokeStyle = "#000" // "#0ce"
                    ctx.lineWidth = 0.5
                    ctx.beginPath();
                    ctx.moveTo(where.x, where.y);
                    ctx.quadraticCurveTo(controlPoint.x, controlPoint.y, this.vertices[ropeIndex].x, this.vertices[ropeIndex].y)
                    // ctx.lineTo(this.vertices[0].x, this.vertices[0].y);
                    ctx.stroke();
                },
                draw() { },
                returnToPlayer() {
                    if (Vector.magnitude(Vector.sub(this.position, bot.position)) < returnRadius) { //near player
                        this.endCycle = 0;
                        // if (m.energy < 0.05) {
                        //     m.fireCDcycle = m.cycle + 80 * b.fireCDscale; //fire cooldown is much longer when out of energy
                        // } else if (m.cycle + 20 * b.fireCDscale < m.fireCDcycle) {
                        // if (m.energy > 0.05) m.fireCDcycle = m.cycle + 20 * b.fireCDscale //lower cd to 25 if it is above 25
                        // }
                        //recoil on catching
                        const momentum = Vector.mult(Vector.sub(this.velocity, bot.velocity), (m.crouch ? 0.0001 : 0.0002))
                        bot.force.x += momentum.x
                        bot.force.y += momentum.y
                        // refund ammo
                        if (isReturnAmmo) {
                            b.guns[9].ammo++;
                            simulation.updateGunHUD();
                            // for (i = 0, len = b.guns.length; i < len; i++) { //find which gun 
                            //     if (b.guns[i].name === "harpoon") {
                            //         break;
                            //     }
                            // }
                        }
                    } else {
                        const sub = Vector.sub(this.position, m.pos)
                        const rangeScale = 1 + 0.000001 * Vector.magnitude(sub) * Vector.magnitude(sub) //return faster when far from player
                        const returnForce = Vector.mult(Vector.normalise(sub), rangeScale * thrust * this.mass)
                        if (m.energy > this.drain) m.energy -= this.drain
                        if (m.energy < 0.05) {
                            this.force.x -= returnForce.x * 0.15
                            this.force.y -= returnForce.y * 0.15
                        } else { //if (m.cycle + 20 * b.fireCDscale < m.fireCDcycle)
                            this.force.x -= returnForce.x
                            this.force.y -= returnForce.y
                        }
                        this.grabPowerUp()
                    }
                    this.draw();
                },
                grabPowerUp() { //grab power ups near the tip of the harpoon
                    const grabPowerUpIndex = 2
                    if (this.caughtPowerUp) {
                        Matter.Body.setPosition(this.caughtPowerUp, Vector.add(this.vertices[grabPowerUpIndex], this.velocity))  //this.vertices[2]
                        Matter.Body.setVelocity(this.caughtPowerUp, { x: 0, y: 0 })
                    } else { //&& simulation.cycle % 2 
                        for (let i = 0, len = powerUp.length; i < len; ++i) {
                            if (tech.isEnergyNoAmmo && powerUp[i].name === "ammo") continue
                            const radius = powerUp[i].circleRadius + 50
                            if (Vector.magnitudeSquared(Vector.sub(this.vertices[grabPowerUpIndex], powerUp[i].position)) < radius * radius && !powerUp[i].isGrabbed) {  //this.vertices[2]
                                if (powerUp[i].name !== "heal" || m.health !== m.maxHealth || tech.isOverHeal) {
                                    powerUp[i].isGrabbed = true
                                    this.caughtPowerUp = powerUp[i]
                                    Matter.Body.setVelocity(powerUp[i], { x: 0, y: 0 })
                                    Matter.Body.setPosition(powerUp[i], this.vertices[grabPowerUpIndex])
                                    powerUp[i].collisionFilter.category = 0
                                    powerUp[i].collisionFilter.mask = 0
                                    thrust *= 0.6
                                    this.endCycle += 0.5 //it pulls back slower, so this prevents it from ending early
                                    break //just pull 1 power up if possible
                                }
                            }
                        }
                    }
                },
                do() {
                    this.cycle++
                    if (isReturn || target) {
                        if (isReturn) {
                            if (this.cycle > totalCycles) { //return to player  //|| !input.fire
                                this.do = this.returnToPlayer
                                if (this.angularSpeed < 0.5) this.torque += this.inertia * 0.001 * (Math.random() - 0.5) //(Math.round(Math.random()) ? 1 : -1)
                                Matter.Sleeping.set(this, false)
                                this.endCycle = simulation.cycle + 240
                                const momentum = Vector.mult(Vector.sub(this.velocity, player.velocity), (m.crouch ? 0.00015 : 0.0003)) //recoil on jerking line
                                player.force.x += momentum.x
                                player.force.y += momentum.y
                                requestAnimationFrame(() => { //delay this for 1 cycle to get the proper hit graphics
                                    this.collisionFilter.category = 0
                                    this.collisionFilter.mask = 0
                                });
                            } else {
                                this.grabPowerUp()
                            }
                        }
                        if (target) { //rotate towards the target
                            const face = {
                                x: Math.cos(this.angle),
                                y: Math.sin(this.angle)
                            };
                            const vectorGoal = Vector.normalise(Vector.sub(this.position, target.position));
                            if (Vector.cross(vectorGoal, face) > 0) {
                                Matter.Body.rotate(this, this.turnRate);
                            } else {
                                Matter.Body.rotate(this, -this.turnRate);
                            }
                        }
                        this.force.x += thrust * this.mass * Math.cos(this.angle);
                        this.force.y += thrust * this.mass * Math.sin(this.angle);
                    }
                    this.draw()
                },
            });
            if (!isReturn && !target) {
                Matter.Body.setVelocity(bullet[me], {
                    x: 0.7 * player.velocity.x + 600 * thrust * Math.cos(bullet[me].angle),
                    y: 0.5 * player.velocity.x + 600 * thrust * Math.sin(bullet[me].angle)
                });
                bullet[me].frictionAir = 0.002
                bullet[me].do = function () {
                    if (this.speed < 20) this.force.y += 0.0005 * this.mass;
                    this.draw();
                }
            }
            if (tech.isHarpoonPowerUp && simulation.cycle - 480 < tech.harpoonPowerUpCycle) { //8 seconds
                if (isReturn) {
                    bullet[me].draw = function () {
                        this.drawDamageAura()
                        this.drawString()
                    }
                } else {
                    bullet[me].draw = function () {
                        this.drawDamageAura()
                    }
                }
            } else if (isReturn) {
                bullet[me].draw = function () {
                    this.drawString()
                }
            }
            Composite.add(engine.world, bullet[me]); //add bullet to world
        }
    }
    Object.assign(b, addBot);
  	const t = [
		{
			name: "harpoon-bot",
			descriptionFunction() {
				return `construct a <strong class='color-bot'>bot</strong> that fires <strong>harpoons</strong> at mobs<br>collects nearby <b>power ups</b>`
			},
			isGunTech: false,
			maxCount: 1,
			count: 0,
			frequency: 1,
            frequencyDefault: 1,
            isBot: true,
            isBotTech: true,
			allowed() {
				return true
			},
			requires: "",
			effect() {
                b.harpoonBot();
                tech.harpoonBot = true;
				simulation.ephemera.push({
                    name: "harpoonBot",
                    do() {
                        if (simulation.cycle % 250 === 0) {
                            let harpoonFound = false;

                            for (let i = 0; i < bullet.length; i++) {
                            if (bullet[i].botType === "harpoon") {
                                harpoonFound = true;
                                break; 
                            }
                            }

                            if (!harpoonFound) {
                            b.harpoonBot();
                            }
                        }
                    }
                })
			},
			remove() {
                tech.harpoonBot = false;
				simulation.removeEphemera("harpoonBot")
			}
		},
        {
            name: "harpoon-bot upgrade",
            description: "<b>upgrade</b> your harpoon <strong class='color-bot'>bot</strong><br>to deal more <strong class='color-d'>damage</strong>",
            maxCount: 1,
            count: 0,
            frequency: 3,
            frequencyDefault: 3,
            isBotTech: true,
            allowed() {
                return tech.harpoonBot
            },
            requires: "harpoon bot",
            effect() {
                tech.isHarpoonBotUpgrade = true
            },
            remove() {
                tech.isHarpoonBotUpgrade = false
            }
        },
	];
	t.reverse();
	for(let i = 0; i < tech.tech.length; i++) {
		if(tech.tech[i].name === 'perimeter defense') {
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
	console.log("%cHarpoon bot mod successfully installed", "color: gray");
})();
