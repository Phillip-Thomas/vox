import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  createScenePlayerPositionMailbox,
  createScenePlayerPositionStreams
} from './scenePlayerPosition.ts';

describe('createScenePlayerPositionMailbox', () => {
  it('keeps one consumer-visible identity across recurring render-loop publications', () => {
    const mailbox = createScenePlayerPositionMailbox(new THREE.Vector3(1, 2, 3));
    const consumerPosition = mailbox.position;

    // Reproduce a sustained onPositionChange stream. The former implementation
    // allocated a new vector and enqueued React state for every accepted sample;
    // this boundary instead updates the already-mounted consumers in place.
    for (let frame = 0; frame < 10_000; frame += 1) {
      mailbox.publish(new THREE.Vector3(frame, frame * -0.5, frame * 0.25));
      expect(mailbox.position).toBe(consumerPosition);
    }

    expect(consumerPosition.toArray()).toEqual([9999, -4999.5, 2499.75]);
  });

  it('owns its value instead of mutating or retaining the publisher vector', () => {
    const initial = new THREE.Vector3(1, 2, 3);
    const mailbox = createScenePlayerPositionMailbox(initial);
    const sample = new THREE.Vector3(4, 5, 6);

    mailbox.publish(sample);
    sample.set(40, 50, 60);
    initial.set(10, 20, 30);

    expect(mailbox.position.toArray()).toEqual([4, 5, 6]);
  });
});

describe('createScenePlayerPositionStreams', () => {
  it('bounds atmospheric collision to 15 Hz and ecology to 400 ms', () => {
    const streams = createScenePlayerPositionStreams(new THREE.Vector3());
    const collisionIdentity = streams.collision.position;
    const ecologyIdentity = streams.ecology.position;
    let collisionPublications = 0;
    let ecologyPublications = 0;

    for (let frame = 0; frame < 60; frame += 1) {
      const result = streams.publish(new THREE.Vector3(frame * 5, 0, 0), {
        nowMs: frame * (1000 / 60),
        phase: 'descent',
        controlMode: 'flight'
      });
      if (result.collision) collisionPublications += 1;
      if (result.ecology) ecologyPublications += 1;
    }

    expect(collisionPublications).toBeLessThanOrEqual(15);
    expect(ecologyPublications).toBeLessThanOrEqual(3);
    expect(streams.collision.position).toBe(collisionIdentity);
    expect(streams.ecology.position).toBe(ecologyIdentity);
  });

  it('freezes both planet-local streams in deep space', () => {
    const streams = createScenePlayerPositionStreams(new THREE.Vector3(1, 2, 3));
    const result = streams.publish(new THREE.Vector3(500, 600, 700), {
      nowMs: 1000,
      phase: 'deep_space',
      controlMode: 'flight'
    });

    expect(result).toEqual({ collision: false, ecology: false });
    expect(streams.collision.position.toArray()).toEqual([1, 2, 3]);
    expect(streams.ecology.position.toArray()).toEqual([1, 2, 3]);
  });

  it('keeps ecology current with each accepted on-foot sample', () => {
    const streams = createScenePlayerPositionStreams(new THREE.Vector3());
    const first = streams.publish(new THREE.Vector3(2, 0, 0), {
      nowMs: 0,
      phase: 'surface',
      controlMode: 'fps'
    });
    const second = streams.publish(new THREE.Vector3(4, 0, 0), {
      nowMs: 70,
      phase: 'surface',
      controlMode: 'fps'
    });

    expect(first).toEqual({ collision: true, ecology: true });
    expect(second).toEqual({ collision: true, ecology: true });
    expect(streams.ecology.position.toArray()).toEqual([4, 0, 0]);
  });
});
