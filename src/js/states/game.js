(function() {
  'use strict';

  function Game() {
  }

  Game.prototype = {
    create: function () {
      this.randSeed = Date.now();
      this.score = 0;
      this.style = { font: '16px nasalization', fill: '#FFFFFF', align: 'center' };

      this.bg = this.add.sprite(0, 0, 'bg');
      this.bg.scale.set(0.5, 0.5);

      this.cursors = this.game.input.keyboard.createCursorKeys();
      this.game.input.mouse.mouseWheelCallback = this.mouseMovePlayer.bind(this);

      this.target = { x: this.game.width * 1.1, y: this.game.height / 2 };

      this.earth = this.add.sprite(this.game.width * 1.72, this.game.height * 0.5, 'earth');
      this.earth.anchor.setTo(0.5, 0.5);
      this.earth.r = (this.earth.width * 0.5);

      // Angle between earth center and bottom right corner
      this.bottomRightAngle = this.game.physics.arcade.angleToXY(this.earth, this.game.width, this.game.height)*180/Math.PI;

      this.mocha = this.add.sprite(0, this.game.height * 0.5, 'mocha');
      this.mocha.anchor.setTo(0.5, 0.5);
      this.mocha.angle = 90;

      this.cannon = this.add.sprite(0, 0, 'cannon');
      this.cannon.position.x = this.mocha.height * 0.45;
      this.cannon.position.y = this.game.height * 0.5;
      this.cannon.scale.set(0.25, 0.25);
      this.cannon.anchor.set(0.5, 1.2);
      this.cannon.r = (this.cannon.width * 0.5);

      this.pinpoints = this.game.add.group();
      this.pums      = this.game.add.group();

      //this.pinpoints.checkWorldBounds = true;
      //this.pinpoints.outOfBoundsKill = true;
      //this.pums.checkWorldBounds = true;
      //this.pums.outOfBoundsKill = true;


      this.sounds = {
        soundtrack: this.game.add.audio('soundtrack', 0.05, true),
        actions: {
            fire          : this.game.add.audio('fire'),
            hit           : this.game.add.audio('hit'),
            earth_hit     : this.game.add.audio('earth_hit'),
            junk_hit      : this.game.add.audio('junk_hit'),
            miss          : this.game.add.audio('miss'),
            new_pin       : this.game.add.audio('new_pin'),
            ship_hit      : this.game.add.audio('ship_hit'),
        }
      };

      var numPins = 3;
      for(var i=0; i<numPins; i++){
        this.game.time.events.add(Phaser.Timer.SECOND*5*i, this.newPin, this);
      }

      this.earth.addChild(this.pinpoints);
      this.earth.addChild(this.pums);

      this.keyShoot = this.game.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);
      this.keyShoot.onDown.add(this.fire, this);

      this.lineProperties = this.add.bitmapData(this.game.width, this.game.height);
      this.lineProperties.ctx.beginPath();
      this.lineProperties.ctx.lineWidth = '2';
      this.lineProperties.ctx.setLineDash([2, 15]);
      this.lineProperties.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      this.lineProperties.ctx.stroke();

      this.line = this.add.sprite(0, 0, this.lineProperties);
      this.trajectoryLine();

      this.sounds.soundtrack.play();

      this.game.world.bringToTop(this.mocha);
      this.game.world.bringToTop(this.earth);

      this.textSprite = this.game.add.text(20, 10, 'PLANET MOCHA', this.style);
      this.textSprite = this.game.add.text(20, 30, 'SCORE: 0', this.style);

      this.game.time.events.loop(Phaser.Timer.SECOND,  this.maybeGenJunk, this);
    },

    genPinPointAngle : function(){
        var angle = null;
        this.pinAngles = this.pinAngles || {};
        while(angle === null){
            angle = Math.floor((Math.floor(this.random(1,4)*5+153)-this.earth.angle)/5)*5;
            if(this.pinAngles[angle]){ angle = null; }
            else { this.pinAngles[angle] = true;     }
        }
        return angle;
    },
    update: function () {
      if (!!this.coffee && this.coffee.exists) {
        this.steerCoffee();
      } else {
        this.steerCannon();
      }

      this.earth.angle = (this.game.time.now) * 0.00008 * (180 / Math.PI);
      //this.checkOutOfBoundsPins();
      this.trajectoryLine();
      this.movePlayer();
      this.checkCoffeeCollision();
      this.updateCoffeeSpeed();
      this.drawScore();
    },

    checkOutOfBoundsPins: function() {
      this.pinpoints.forEach(function(pin) {
        var pinWorldAngle = pin.angle + this.earth.angle;
        if (pinWorldAngle > 195 && pinWorldAngle < 100) {
          this.renewPin(this.pinpoints.getIndex(pin));
        }
      }, this);
    },

    drawScore: function() {
      this.textSprite.text = 'SCORE: ' + this.score;
    },

    fire: function() {
      // only one coffee at a time
      if (!!this.coffee && this.coffee.exists) {
        return;
      }

      this.coffee = this.add.sprite(this.cannonTip().x, this.cannonTip().y, 'coffee');

      this.coffee.checkWorldBounds = true;
      this.coffee.anchor.set(0.5, 0.5);
      this.coffee.scale.set(0.2, 0.2);
      this.coffee.hit = false;
      this.game.physics.arcade.enable(this.coffee);
      this.coffee.events.onOutOfBounds.add(function() {
        this.line.visible = true;
        this.playFx(this.sounds.actions.miss);
      }, this);

      this.coffeeFlame = this.add.sprite(0, 0, 'flames');
      this.coffee.addChild(this.coffeeFlame);
      this.coffeeFlame.anchor.set(1.3, 0.5);
      this.coffeeFlame.animations.add('walk');
      this.coffeeFlame.animations.play('walk', 10, true);
      this.coffee.outOfBoundsKill = true;

      this.coffee.angle = this.cannon.angle - 90;
      this.updateCoffeeSpeed();
      this.playFx(this.sounds.actions.fire);
      this.line.visible = false;
    },

    updateCoffeeSpeed: function() {
      if (!this.coffee || !this.coffee.body) {
        return;
      }

      var linearVelocity = 200;

      this.coffee.body.velocity.x = linearVelocity * Math.cos(this.coffee.angle * Math.PI / 180);
      this.coffee.body.velocity.y = linearVelocity * Math.sin(this.coffee.angle * Math.PI / 180);
    },

    playFx: function(sound){
        sound.play();
    },

    trajectoryLine: function() {
      this.lineProperties.clear();
      this.lineProperties.ctx.beginPath();
      this.lineProperties.ctx.moveTo(this.cannonTip().x, this.cannonTip().y);
      this.lineProperties.ctx.lineTo(this.target.x, this.target.y);
      this.lineProperties.ctx.stroke();
      this.lineProperties.ctx.closePath();
      this.lineProperties.render();
    },

    cannonTip: function() {
      return {
        x: (this.cannon.world.x + Math.sin(this.cannon.angle * Math.PI/180) * this.cannon.height * 1.2),
        y: (this.cannon.world.y - Math.cos(this.cannon.angle * Math.PI/180) * this.cannon.width * 1.2)
      };
    },

    movePlayer: function() {
      var velocity = 6;
      var margin = 60;

      if (this.cursors.down.isDown) {
        if (this.target.y < this.earth.y + this.earth.height / 2 + margin) {
          this.target.y += velocity;
        }
      }

      if (this.cursors.up.isDown) {
        if (this.target.y > this.earth.y - this.earth.height / 2 - margin) {
          this.target.y -= velocity;
        }
      }

    },

    mouseMovePlayer: function(){
      var velocity = 20;
      var margin = 60;

      if(this.game.input.mouse.wheelDelta === Phaser.Mouse.WHEEL_UP){
        if (this.target.y < this.earth.y + this.earth.height / 2 + margin) {
          this.target.y -= velocity;
        }
      } else {
        if (this.target.y > this.earth.y - this.earth.height / 2 - margin) {
          this.target.y += velocity;
        }
      }

    },

    steerCannon: function() {
      var angle = Math.atan2(this.target.y - this.cannon.y, this.target.x - this.cannon.x);
      angle = angle * (180/Math.PI);

      if (angle < 0) {
        angle = 360 - (-angle);
      }

      this.cannon.angle = 90 + angle;
    },
    steerCoffee: function() {
      var angularVelocity = 1.5;

      if (this.cursors.down.isDown) {
        this.coffee.angle += angularVelocity;
        this.coffee.lastSteeredAt = Date.now();
      }

      if (this.cursors.up.isDown) {
        this.coffee.angle -= angularVelocity;
        this.coffee.lastSteeredAt = Date.now();
      }

      if (this.coffee.angle < -50) {
        this.coffee.angle = -50;
      } else if (this.coffee.angle > 50) {
        this.coffee.angle = 50;
      }

      this.updateCoffeeSpeed();
    },
    maybeGenJunk: function(){
        // Run every second, generate junk prob% of the times
        var prob = 80;
        if(this.random(1,100) < prob){
            this.junks = this.junks || this.game.add.group();
            var from = {}; var to   = {};
            var rand = this.random(0,1);

            from.x = this.random(this.game.width * 0.2, this.game.width * 0.8);
            to.x   = this.random(this.game.width * 0.2, this.game.width * 0.8);

            if(rand==0){
              from.y = -50;
              to.y   = this.game.height+0;
            } else if(rand==1){
              from.y = this.game.height+0;
              to.y   = -50;
            }

            var junk;
            var prob = this.random(1,30);
            // Meteor
            if(prob < 25){
                if (this.random(0, 1) < 1) {
                  junk = this.add.sprite(from.x, from.y, 'commet');
                } else {
                  junk = this.add.sprite(from.x, from.y, 'commet-purple');
                }
                junk.animations.add('walk');
                junk.animations.play('walk', 10, true);
                junk.r = junk.width * 0.08;
                this.junks.add(junk);
                junk.anchor.set(0.5, 0.5);
                junk.scale.set(0.15, 0.15);
            }
            else {
              junk = this.add.sprite(from.x, from.y, 'ship');
              var flame = this.add.sprite(0, 0, 'shipFlame');
              flame.animations.add('walk');
              flame.animations.play('walk', 10, true);
              junk.addChild(flame);
              flame.scale.set(0.3,0.5);
              flame.anchor.set(-0.45, 0.5);
              junk.r = junk.width * 0.3;
              this.junks.add(junk);
              junk.anchor.set(0.5, 0.5);
              junk.scale.set(0.7, 0.7);
            }

            junk.outOfBoundsKill = true;
            this.game.physics.enable(junk, Phaser.Physics.ARCADE);
            junk.rotation = this.game.physics.arcade.moveToXY(junk,to.x, to.y, 60) + Math.PI;
        }
    },
    random: function(min, max) {
        this.randSeed = this.randSeed+1;
        var seed = this.randSeed;

        var random = function() {
            var x = Math.sin(seed++) * 10000;
            return x - Math.floor(x);
        };
        var rand = Math.floor(random() * (max - min + 1)) + min;
        return rand;
    },
    checkCoffeeCollision: function() {
      if (!this.coffee || !this.coffee.exists) {
        return;
      }

      if (this.junks) {
        this.junks.forEach(function(junk) {
          if (!junk.notCollidable && this.circlesOverlap(this.coffee, junk)) {
            this.coffee.kill();
            this.line.visible = true;
            junk.body.velocity.x = 0;
            junk.body.velocity.y = 0;
            junk.scale.set(1, 1);
            junk.rotation = 0.25;
            if (junk.tween)
              junk.tween.stop();
            else
              junk.body.angularVelocity = 0

            if (junk.key === "ship"){
              this.playFx(this.sounds.actions.ship_hit);
              this.score -= 1;
            } else {
              this.playFx(this.sounds.actions.junk_hit);
              this.score -= 1;
            }

            junk.r = undefined;
            junk.kill();

            var emitter = this.game.add.emitter(0, 0, 1000);
            emitter.makeParticles(['red', 'orange', 'yellow']);

            emitter.x = junk.x;
            emitter.y = junk.y;

            emitter.start(true, 2000, 1, 20, 20)


            junk.notCollidable = true;
            junk.children.forEach(function(c){ c.kill(); });
            junk.scale.set(0.2, 0.2);
            junk.tween = this.add.tween(junk).to({
              alpha: 0,
            }, 1000, Phaser.Easing.Quadratic.InOut);
            junk.tween.start();
            this.timer = this.game.time.create(this.game);
            this.timer.add(1000, function() {
              this.junks.remove(junk);
              junk.destroy();
              emitter.destroy();
            }, this);
            this.timer.start();
          }

        }, this);
      }


      if (this.circlesOverlap(this.earth, this.coffee)) {
        // Already handled the hit, skip
        if(this.coffee.hit){ return; }

        // Get pin with minimum center distance to coffee
        var minDist = null;
        var minDistIndex = -1;
        this.pinpoints.forEach(function(pin) {
          if (this.circlesOverlap(this.coffee, pin)) {
            var i = this.pinpoints.getIndex(pin);
            var dist = this.centerDists(this.coffee, pin);
            if(!minDist || dist < minDist){
                minDist = dist;
                minDistIndex = i;
            }
          }
        }, this);

        // Earth hit
        if(minDistIndex === -1){
          this.score -= 1;
          this.playFx(this.sounds.actions.earth_hit);
        }
        // Pin hit
        else {
          this.pums.getChildAt(minDistIndex).visible = true;
          this.pinpoints.getChildAt(minDistIndex).visible = false;
          this.coffee.hit = true;
          this.playFx(this.sounds.actions.hit);
          this.score += 5;
          this.game.time.events.add(Phaser.Timer.SECOND,  function(){ this.renewPin(minDistIndex); }.bind(this), this);
        }

        this.coffee.kill();
        this.line.visible = true;
      }
    },
    newPin: function(){
        var pin   = this.pinpoints.create(0, 0, 'pinpoint');
        var pum   = this.pums.create(0, 0, 'smile');
        pin.startAngle = this.genPinPointAngle();
        pin.angle = pin.startAngle;
        pin.r          = 15;
        pum.angle      = pin.angle;
        pin.scale      = {x: 0.8, y: 0.8};
        pin.anchor     = {x:   0.2, y: 0.5};
        pum.anchor     = {x:   0, y: 0.5};
        pum.scale     = {x:   0.8, y: 0.8};
        pum.visible    = false;


        this.pinpoints.add(pin);
        this.pums.add(pum);

        pin.x = this.earth.width * 0.497 * Math.cos(pin.angle * Math.PI / 180);
        pin.y = this.earth.width * 0.497 * Math.sin(pin.angle * Math.PI / 180);

        pum.x = (this.earth.width+10) * 0.497 * Math.cos(pum.angle * Math.PI / 180);
        pum.y = (this.earth.width+10) * 0.497 * Math.sin(pum.angle * Math.PI / 180);

        pin.enableBody = true;
        pin.checkWorldBounds = true;
        pin.outOfBoundsKill = true;
        pin.events.onOutOfBounds.add(function(){
            if(pin.out){ return; }
            pin.out = true;
            delete this.pinAngles[pin.startAngle];
            this.score -= 1;
            this.newPin();
        }, this);
        this.playFx(this.sounds.actions.new_pin);
    },
    renewPin: function(index){
        var pinpoint = this.pinpoints.getChildAt(index);
        var pum      = this.pums.getChildAt(index);
        pinpoint.kill();
        delete this.pinAngles[pinpoint.startAngle];
        this.pinpoints.remove(pinpoint);
        pum.kill();
        this.pums.remove(pum);
        this.game.time.events.add(Phaser.Timer.SECOND*2,  this.newPin, this);
    },

    circlesOverlap: function(circle1,circle2) {
      var distance = Math.sqrt(Math.pow(circle1.world.x - circle2.world.x, 2) + Math.pow(circle1.world.y - circle2.world.y, 2));
      return (distance < Math.max(circle1.r || circle1.width, circle2.r || circle2.width));
    },
    centerDists: function(circle1, circle2){
      return Math.sqrt(Math.pow(circle1.world.x - circle2.world.x, 2) + Math.pow(circle2.world.y - circle2.world.y, 2));
    }
  };

  window['chimera'] = window['chimera'] || {};
  window['chimera'].Game = Game;

}());
