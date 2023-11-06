javascript:(function() {
    check();
    function isScythePresent() {
        for (let i = 0; i < simulation.ephemera.length; i++) {
            if (simulation.ephemera[i].name === "scythe") {
                return true; 
            }
        }
        return false; 
    }
    function check() {
        if (!isScythePresent()) {
            active();
        }
        requestAnimationFrame(check);
    }
    const e = {
        name: atob("c2N5dGhl"),
        ammo: 0,
        ammoPack: Infinity,
        defaultAmmoPack: 15,
        have: false,
        descriptionFunction() {
            return `throw a <b>scythe</b> that keeps velocity upon collisions<br>drains <strong class='color-h'>health</strong> instead of ammunition<br>Drains 10 <strong class='color-h'>health</strong>`
        },
        do() {},
        fire() {}
    };
    b.guns.push(e);
    const gunArray = b.guns.filter(
    (obj, index, self) =>
        index === self.findIndex((item) => item.name === obj.name)
    );
    b.guns = gunArray;

    const t = [
        {
            name: "drawn out",
            link: `<a target="_blank" href='https://en.wikipedia.org/wiki/Forging' class="link">drawn out</a>`,
            descriptionFunction() {
                return `<strong>+1</strong> scythe blade parts<br><strong>+30%</strong> scythe <strong class="color-d">damage</strong>`
            },
            isGunTech: true,
            maxCount: 1,
            count: 0,
            frequency: 2,
            frequencyDefault: 2,
            allowed() {
                return tech.haveGunCheck("scythe")
            },
            requires: "scythe",
            effect() {
                tech.isLongBlade = true;
            },
            remove() {
                tech.isLongBlade = false;
            }
        },
        {
            name: "Ti-6Al-4V",
            link: `<a target="_blank" href='https://en.wikipedia.org/wiki/Ti-6Al-4V' class="link">Ti-6Al-4V</a>`,
            descriptionFunction() {
                return `<strong>+10%</strong> scythe <strong>range</strong><br><strong>+15%</strong> scythe <strong class="color-d">damage</strong>`
            },
            isGunTech: true,
            maxCount: 9,
            count: 0,
            frequency: 2,
            frequencyDefault: 2,
            allowed() {
                return tech.haveGunCheck("scythe") && !tech.isPhaseScythe
            },
            requires: "scythe, not phase transition",
            effect() {
                tech.scytheRange = this.count;
                tech.isScytheRange = true;
            },
            remove() {
                tech.scytheRange = 0;
                tech.isScytheRange = false;
            }
        },
        {
            name: "potential flow",
            descriptionFunction() {
                return `<strong style="color: indigo;">+0.1</strong> scythe <strong style="color: indigo;">rotation radians</strong><br><strong>+50%</strong> scythe <strong class="color-d">damage</strong>`
            },
            isGunTech: true,
            maxCount: 3,
            count: 0,
            frequency: 2,
            frequencyDefault: 2,
            allowed() {
                return tech.haveGunCheck("scythe") && !tech.isMeleeScythe
            },
            requires: "scythe, not reaping",
            effect() {
                tech.isScytheRad = true;
                tech.scytheRad = this.count;
            },
            remove() {
                tech.isScytheRad = false;
                tech.scytheRad = 0;
            }
        },
        {
            name: "duality",
            descriptionFunction() {
                return `forge <strong>+1</strong> scythe blade<br><strong>-10%</strong> scythe <strong class="color-d">damage</strong>`
            },
            link: `<a target="_blank" href='https://en.wikipedia.org/wiki/Duality_(mathematics)' class="link">duality</a>`,
            isGunTech: true,
            maxCount: 1,
            count: 0,
            frequency: 2,
            frequencyDefault: 2,
            allowed() {
                return tech.haveGunCheck("scythe")
            },
            requires: "scythe",
            effect() {
                tech.isDoubleScythe = true;
            },
            remove() {
                tech.isDoubleScythe = false;
            }
        },
        {
            name: "phase transition",
            descriptionFunction() {
                return `when scythe is <strong>active</strong> become <strong>invulnerable</strong><br>drain <strong class="color-f">energy</strong>`
            },
            isGunTech: true,
            maxCount: 1,
            count: 0,
            frequency: 2,
            frequencyDefault: 2,
            allowed() {
                return tech.haveGunCheck("scythe") && !tech.isScytheRange && tech.isEnergyHealth
            },
            requires: "scythe, mass energy, not Ti-6Al-4V",
            effect() {
                tech.isPhaseScythe = true;
            },
            remove() {
                tech.isPhaseScythe = false;
            }
        },
        {
            name: "titanium nitride",
            descriptionFunction() {
                return `scythe now uses <b>ammo</b> instead of <strong class="color-h">health</strong><br><strong>+24%</strong> <strong class='color-junk'>JUNK</strong> to <strong class='color-m'>tech</strong> pool`
            },
            isGunTech: true,
            maxCount: 1,
            count: 0,
            frequency: 2,
            frequencyDefault: 2,
            allowed() {
                return tech.haveGunCheck("scythe") && tech.isScytheRange
            },
            requires: "scythe, Ti-6Al-4V",
            effect() {
                tech.isAmmoScythe = true;
                b.guns[12].ammoPack = b.guns[12].defaultAmmoPack;
                b.guns[12].ammo = b.guns[12].defaultAmmoPack;
                simulation.updateGunHUD();
                this.refundAmount += tech.addJunkTechToPool(0.24);
            },
            refundAmount: 0,
            remove() {
                if (tech.isAmmoScythe) {
                    tech.isAmmoScythe = false;
                    b.guns[12].ammoPack = Infinity;
                    b.guns[12].ammo = Infinity;
                    simulation.updateGunHUD();
                }
                tech.isAmmoScythe = false;
                if (this.count > 0 && this.refundAmount > 0) {
                    tech.removeJunkTechFromPool(this.refundAmount);
                    this.refundAmount = 0;
                }
            }
        },
        {
            name: "reaping",
            descriptionFunction() {
                return `<strong>+2</strong> scythe blades and <strong>+70%</strong> handle length<br>scythe is now used as a <b style="color: crimson;">melee</b>`
            },
            isGunTech: true,
            maxCount: 1,
            count: 0,
            frequency: 2,
            frequencyDefault: 2,
            allowed() {
                return tech.haveGunCheck("scythe") && tech.isDoubleScythe && !tech.isScytheRad
            },
            requires: "scythe, duality",
            effect() {
                tech.isMeleeScythe = true;
            },
            remove() {
                tech.isMeleeScythe = false;
            }
        },
        {
            name: "neurotoxin",
            descriptionFunction() {
                return `scythe <strong>stuns</strong> mobs for 1.5 seconds<br><strong style="color: indigo;">-0.1</strong> scythe <strong style="color: indigo;">rotation radians</strong>`
            },
            isGunTech: true,
            maxCount: 1,
            count: 0,
            frequency: 2,
            frequencyDefault: 2,
            allowed() {
                return tech.haveGunCheck("scythe") && tech.isDoubleScythe && tech.isMeleeScythe
            },
            requires: "scythe, reaping",
            effect() {
                tech.isStunScythe = true;
            },
            remove() {
                tech.isStunScythe = false;
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
    function active() {
        simulation.ephemera.push({
            name: "scythe",
            cycle: 0,
            scythe: undefined,
            bladeSegments: undefined,
            bladeTrails: [],
            angle: 0,
            constraint: undefined,
            do() {
                if (b.activeGun !== null && input.fire && (tech.isEnergyHealth ? m.energy >= 0.11 : m.health >= 0.11)) {
                    if (!this.scythe && b.guns[b.activeGun].name === 'scythe') {
                        ({ scythe: this.scythe, bladeSegments: this.bladeSegments} = this.createAndSwingScythe());
                        this.angle = m.angle;
                        if(!tech.isAmmoScythe && !b.guns[b.activeGun].ammo == 0) {
                            if(tech.isEnergyHealth) {
                                m.energy -= 0.1;
                                if(tech.isPhaseScythe) {
                                    m.immuneCycle = this.cycle;
                                }
                            } else {
                                m.health -= 0.1;
                                m.displayHealth();
                            }
                        }
                    }
                }
                if(this.scythe && m.cycle > this.cycle + 30) {
                    Matter.Body.setAngularVelocity(this.scythe, 0);
                    Composite.remove(engine.world, this.scythe);
                    this.scythe.parts.forEach(part => {
                        Composite.remove(engine.world, part);
                        const index = bullet.indexOf(part);
                        if (index !== -1) {
                            bullet.splice(index, 1);
                        }
                    });
                    this.scythe = undefined;
                    this.bladeTrails = [];
                    m.fireCDcycle = 0;
                    /* if(tech.isMeleeScythe || this.constraint) {
                        Composite.remove(engine.world, this.constraint);
                        this.constraint = undefined;
                    } */
                } else {
                    if (this.scythe && !tech.isMeleeScythe) {
                        if (!(this.angle > -Math.PI / 2 && this.angle < Math.PI / 2)) {
                            Matter.Body.setAngularVelocity(this.scythe, -Math.PI * 0.15 - (tech.scytheRad ? tech.scytheRad * 0.1 : 0));
                        } else {
                            Matter.Body.setAngularVelocity(this.scythe, Math.PI * 0.15 + (tech.scytheRad ? tech.scytheRad * 0.1 : 0));
                        }
                        Matter.Body.setVelocity(this.scythe, {
                            x: Math.cos(this.angle) * 30,
                            y: Math.sin(this.angle) * 30
                        });
                    } else if(this.scythe && tech.isMeleeScythe) {
                        if (!(this.angle > -Math.PI / 2 && this.angle < Math.PI / 2)) {
                            Matter.Body.setAngularVelocity(this.scythe, -Math.PI * 0.1 + (tech.isStunScythe ? 0.1 : 0));
                        } else {
                            Matter.Body.setAngularVelocity(this.scythe, Math.PI * 0.1 - (tech.isStunScythe ? 0.1 : 0));
                        }
                        /* if(!this.constraint) {
                            this.constraint = Constraint.create({
                                bodyA: player,
                                bodyB: this.scythe,
                                stiffness: 1,
                                damping: 0.001
                            });
                            Composite.add(engine.world, this.constraint);
                        } */
                        Matter.Body.setPosition(this.scythe, player.position);
                    }
                }
                if(this.scythe) {
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
                            } else if (tech.isAmmoScythe) {
                                ctx.fillStyle = `#c0c0c0${Math.round(alpha * 255).toString(16).padStart(2, '0')}`
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
                        ctx.strokeStyle = tech.isEnergyHealth ? m.fieldMeterColor : tech.isAmmoScythe ? "#c0c0c0" : "crimson";
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
                if(this.scythe) {
                    for (let i = 0; i < mob.length; i++) {
                        if (Matter.Query.collides(this.scythe, [mob[i]]).length > 0) {
                            const dmg = m.dmgScale * 0.12 * 2.73 * (tech.isLongBlade ? 1.3 : 1) * (tech.scytheRange ? tech.scytheRange * 1.15 : 1) * (tech.isDoubleScythe ? 0.9 : 1) * (tech.scytheRad ? tech.scytheRad * 1.5 : 1);
                            mob[i].damage(dmg, true);
                            simulation.drawList.push({
                                x: mob[i].position.x,
                                y: mob[i].position.y,
                                radius: Math.sqrt(dmg) * 50,
                                color: simulation.mobDmgColor,
                                time: simulation.drawTime
                            });
                            if(!tech.isMeleeScythe) {
                                const angle = Math.atan2(mob[i].position.y - this.scythe.position.y, mob[i].position.x - this.scythe.position.x);
                                this.scythe.force.x += Math.cos(angle) * 2;
                                this.scythe.force.y += Math.sin(angle) * 2;
                            }
                            if(tech.isStunScythe) {
                                mobs.statusStun(mob[i], 90);
                            }
                            break
                        }
                    }
                }
            },
            createAndSwingScythe(x = player.position.x, y = player.position.y, angle = m.angle) {
                if (this.cycle < m.cycle) {
                    this.cycle = m.cycle + 60 + (tech.scytheRange * 6);
                    m.fireCDcycle = Infinity;
                    const handleWidth = 20;
                    const handleHeight = 200 + (tech.isLongBlade ? 30 : 0) + (tech.isMeleeScythe ? 140 : 0);
                    const handle = Bodies.rectangle(x, y, handleWidth, handleHeight, spawn.propsIsNotHoldable);
                    bullet[bullet.length] = handle;
                    bullet[bullet.length - 1].do = () => {};
                    const bladeWidth = 100;
                    const bladeHeight = 20;
                    const numBlades = 10 + (tech.isLongBlade ? 1 : 0) + (tech.isMeleeScythe ? 2 : 0);
                    const extensionFactor = 5.5;
                    const bladeSegments = [];
                    if(!tech.isDoubleScythe) {
                        for (let i = 0; i < numBlades; i++) {
                            const extensionFactorFraction = (i / (numBlades - 1)) * extensionFactor;
                            const bladeX = x - handleWidth / 2 + i * (bladeWidth / 2) - extensionFactorFraction * (bladeWidth / 2);
                            const bladeY = y + handleHeight / 2 - i * (bladeHeight / (3 ** i));
                
                            const vertices = [
                                { x: bladeX, y: bladeY - bladeHeight / 2 }, 
                                { x: bladeX + bladeWidth / 2, y: bladeY + bladeHeight / 2 },
                                { x: bladeX - bladeWidth / 2, y: bladeY + bladeHeight / 2 },
                                { x: bladeX, y: bladeY - bladeHeight / 2 + 10 },
                            ];
                
                            const blade = Bodies.fromVertices(bladeX, bladeY, vertices, spawn.propsIsNotHoldable);
                            bullet[bullet.length] = blade;
                            bullet[bullet.length - 1].do = () => {};
                            Matter.Body.rotate(blade, -Math.sin(i * (Math.PI / 180) * 5));
                            bladeSegments.push(blade);
                        }
                    } else {
                        for (let i = 0; i < numBlades; i++) {
                            const extensionFactorFraction = (i / (numBlades - 1)) * extensionFactor;
                            const bladeX = x - handleWidth / 2 + i * (bladeWidth / 2) - extensionFactorFraction * (bladeWidth / 2);
                            const bladeY = y + handleHeight / 2 - i * (bladeHeight / (3 ** i));
                
                            const vertices = [
                                { x: bladeX, y: bladeY - bladeHeight / 2 }, 
                                { x: bladeX + bladeWidth / 2, y: bladeY + bladeHeight / 2 },
                                { x: bladeX - bladeWidth / 2, y: bladeY + bladeHeight / 2 },
                                { x: bladeX, y: bladeY - bladeHeight / 2 + 10 },
                            ];
                
                            const blade = Bodies.fromVertices(bladeX, bladeY, vertices, spawn.propsIsNotHoldable);
                            bullet[bullet.length] = blade;
                            bullet[bullet.length - 1].do = () => {};
                            Matter.Body.rotate(blade, -Math.sin(i * (Math.PI / 180) * 5));
                            bladeSegments.push(blade);
                        }

                        for (let i = 0; i < numBlades; i++) {
                            const extensionFactorFraction = (i / (numBlades - 1)) * extensionFactor;
                            const bladeX = x + handleWidth / 2 - i * (bladeWidth / 2) + extensionFactorFraction * (bladeWidth / 2);
                            const bladeY = y - handleHeight / 2 - i * (bladeHeight / (3 ** i));
                
                            const vertices = [
                                { x: bladeX, y: bladeY - bladeHeight / 2 }, 
                                { x: bladeX + bladeWidth / 2, y: bladeY + bladeHeight / 2 },
                                { x: bladeX - bladeWidth / 2, y: bladeY + bladeHeight / 2 },
                                { x: bladeX, y: bladeY - bladeHeight / 2 + 10 },
                            ];
                
                            const blade = Bodies.fromVertices(bladeX, bladeY, vertices, spawn.propsIsNotHoldable);
                            bullet[bullet.length] = blade;
                            bullet[bullet.length - 1].do = () => {};
                            Matter.Body.rotate(blade, -Math.sin(i * (Math.PI / 180) * 5) + Math.PI);
                            bladeSegments.push(blade);
                        }
                    }
                    const scythe = Body.create({
                        parts: [handle, ...bladeSegments],
                    });
            
                    Composite.add(engine.world, scythe);
                    Matter.Body.setPosition(scythe, { x, y });
            
                    scythe.collisionFilter.category = cat.bullet;
                    scythe.collisionFilter.mask = cat.mobBullet | cat.mob;
            
                    if ((angle > -Math.PI / 2 && angle < Math.PI / 2)) {
                        Body.scale(scythe, -1, 1, { x, y });
                    }

                    scythe.frictionAir -= 0.01;
            
                    return { scythe, bladeSegments };
                }
            },          
        })
    }
    console.log("%cscythe mod successfully installed", "color: crimson");
})();
