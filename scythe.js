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
        description: `throw a <b style="color: ">scythe</b> that keeps velocity upon collisions<br>drains <strong class='color-h'>health</strong> instead of ammunition`,
        ammo: 0,
        ammoPack: Infinity,
        have: false,
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
                return `<strong>+1</strong> scythe blade<br><strong>+30%</strong> scythe <strong class="color-d">damage</strong>`
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
                return `<strong>+0.1</strong> scythe <strong>rotation radians</strong><br><strong>+50%</strong> scythe <strong class="color-d">damage</strong>`
            },
            isGunTech: true,
            maxCount: 3,
            count: 0,
            frequency: 2,
            frequencyDefault: 2,
            allowed() {
                return tech.haveGunCheck("scythe")
            },
            requires: "scythe",
            effect() {
                tech.scytheRad = this.count;
            },
            remove() {
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
            do() {
                if (b.activeGun !== null && input.fire && (tech.isEnergyHealth ? m.energy > 0.11 : m.health >= 0.11)) {
                    if (!this.scythe && b.guns[b.activeGun].name === 'scythe') {
                        ({ scythe: this.scythe, bladeSegments: this.bladeSegments} = this.createAndSwingScythe());
                        this.angle = m.angle;
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
                if(this.scythe && m.cycle > this.cycle + 30) {
                    Matter.Body.setAngularVelocity(this.scythe, 0);
                    Composite.remove(engine.world, this.scythe);

                    this.scythe.parts.forEach(part => {
                        Composite.remove(engine.world, part);
                        const index = body.indexOf(part);
                        if (index !== -1) {
                            body.splice(index, 1);
                        }
                    });

                    this.scythe = undefined;
                    this.bladeTrails = [];
                } else {
                    if (this.scythe) {
                        if (!(this.angle > -Math.PI / 2 && this.angle < Math.PI / 2)) {
                            Matter.Body.setAngularVelocity(this.scythe, -Math.PI * 0.15 - (tech.scytheRad ? tech.scytheRad * 0.1 : 0));
                        } else {
                            Matter.Body.setAngularVelocity(this.scythe, Math.PI * 0.15 + (tech.scytheRad ? tech.scytheRad * 0.1 : 0));
                        }
                        Matter.Body.setVelocity(this.scythe, {
                            x: Math.cos(this.angle) * 30,
                            y: Math.sin(this.angle) * 30
                        });
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
                            const angle = Math.atan2(mob[i].position.y - this.scythe.position.y, mob[i].position.x - this.scythe.position.x);
                            this.scythe.force.x += Math.cos(angle) * 2;
                            this.scythe.force.y += Math.sin(angle) * 2;
                            break
                        }
                    }
                }
            },
            createAndSwingScythe(x = player.position.x, y = player.position.y, angle = m.angle) {
                if (this.cycle < m.cycle) {
                    this.cycle = m.cycle + 60 + (tech.scytheRange * 6);
                    const handleWidth = 20;
                    const handleHeight = tech.isLongBlade ? 220 : 200;
                    const handle = Bodies.rectangle(x, y, handleWidth, handleHeight, spawn.propsIsNotHoldable);
                    body[body.length] = handle;
                    const bladeWidth = 100;
                    const bladeHeight = 20;
                    const numBlades = tech.isLongBlade ? 11 : 10;
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
                            body[body.length] = blade;
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
                            body[body.length] = blade;
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
                            body[body.length] = blade;
                            Matter.Body.rotate(blade, -Math.sin(i * (Math.PI / 180) * 5) + Math.PI);
                            bladeSegments.push(blade);
                        }
                    }
                    const scythe = Body.create({
                        parts: [handle, ...bladeSegments],
                    });
            
                    Composite.add(engine.world, scythe);
                    Matter.Body.setPosition(scythe, { x, y });
            
                    scythe.collisionFilter.category = cat.body;
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
    if(simulation !== undefined) {
        console.log("%cscythe mod successfully installed", "color: crimson");
    } else {
        console.log("%cscythe mod install incomplete", "color: black")
    }
})();