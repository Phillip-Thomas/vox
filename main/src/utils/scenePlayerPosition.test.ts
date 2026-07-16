import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createScenePlayerPositionMailbox } from './scenePlayerPosition.ts';

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
