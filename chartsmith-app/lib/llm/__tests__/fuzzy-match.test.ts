import { performStringReplacement } from '../fuzzy-match';

describe('performStringReplacement', () => {
  it('handles simple match case', () => {
    const content = 'Hello, world! This is a test.';
    const oldStr = 'Hello, world!';
    const newStr = 'Greetings, planet!';

    const result = performStringReplacement(content, oldStr, newStr);

    expect(result.success).toBe(true);
    expect(result.content).toBe('Greetings, planet! This is a test.');
    expect(result.error).toBeUndefined();
  });

  it('returns error when string not found', () => {
    const content = 'Hello, world! This is a test.';
    const oldStr = "This text doesn't exist";
    const newStr = 'Replacement text';

    const result = performStringReplacement(content, oldStr, newStr);

    expect(result.success).toBe(false);
    expect(result.content).toBe(content); // Content should remain unchanged
    expect(result.error).toBeDefined();
    expect(result.error?.message).toBe('Approximate match for replacement not found');
  });

  it('handles multiple replacements', () => {
    const content = 'The quick brown fox jumps over the lazy dog. The quick brown fox is quick.';
    const oldStr = 'quick';
    const newStr = 'fast';

    const result = performStringReplacement(content, oldStr, newStr);

    expect(result.success).toBe(true);
    expect(result.content).toBe('The fast brown fox jumps over the lazy dog. The fast brown fox is fast.');
  });

  it('replaces with empty string', () => {
    const content = 'Hello, world! This is a test.';
    const oldStr = 'This is ';
    const newStr = '';

    const result = performStringReplacement(content, oldStr, newStr);

    expect(result.success).toBe(true);
    expect(result.content).toBe('Hello, world! a test.');
  });

  it('handles real world Chart.yaml dependencies', () => {
    const content = `dependencies:
- condition: ingress-nginx.enabled
  name: ingress-nginx
  repository: https://kubernetes.github.io/ingress-nginx
  version: 4.12.0
- alias: okteto-nginx
  condition: okteto-nginx.enabled
  name: ingress-nginx
  repository: https://kubernetes.github.io/ingress-nginx
  version: 4.12.0`;

    const oldStr = `dependencies:
- condition: ingress-nginx.enabled
  name: ingress-nginx
  repository: https://kubernetes.github.io/ingress-nginx
  version: 4.12.0
- alias: okteto-nginx
  condition: okteto-nginx.enabled
  name: ingress-nginx
  repository: https://kubernetes.github.io/ingress-nginx
  version: 4.12.0`;

    const newStr = `dependencies:
- condition: traefik.enabled
  name: traefik
  repository: https://helm.traefik.io/traefik
  version: 23.1.0
- alias: okteto-traefik
  condition: okteto-traefik.enabled
  name: traefik
  repository: https://helm.traefik.io/traefik
  version: 23.1.0`;

    const result = performStringReplacement(content, oldStr, newStr);

    expect(result.success).toBe(true);
    expect(result.content).toBe(newStr);
  });

  it('handles real world fuzzy match - replace ingress-nginx with traefik config', () => {
    const content = `ingress-nginx:
  enabled: true
  controller:
    enableAnnotationValidations: false
    image:
      chroot: true
      registry: docker.io
      image: okteto/ingress-nginx
      tag: 1.29.0-rc.2
      digestChroot: ""
    allowSnippetAnnotations: true
    admissionWebhooks:
      enabled: false
      namespaceSelector:
        matchLabels:
          dev.okteto.com: "true"
    replicaCount: 2
    affinity:
      nodeAffinity:
        preferredDuringSchedulingIgnoredDuringExecution:
          - preference:
              matchExpressions:
                - key: dev.okteto.com/overloaded
                  operator: DoesNotExist
            weight: 50
      podAntiAffinity:
        preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                  - key: app.kubernetes.io/component
                    operator: In
                    values:
                      - controller
                  - key: app.kubernetes.io/name
                    operator: In
                    values:
                      - ingress-nginx
              topologyKey: kubernetes.io/hostname
    config:
      annotation-value-word-blocklist: load_module,lua_package,_by_lua,root,serviceaccount
      log-format-escape-json: "true"
      log-format-upstream: '{"time": "$time_iso8601", "remote_addr": "$remote_addr", "x_forward_for": "$proxy_add_x_forwarded_for", "request_id": "$req_id", "remote_user": "$remote_user", "bytes_sent": $bytes_sent, "request_time": $request_time, "status": $status, "vhost": "$host", "request_proto": "$server_protocol", "path": "$uri", "request_query": "$args", "request_length": $request_length, "duration": $request_time,"method": "$request_method", "http_referrer": "$http_referer", "http_user_agent": "$http_user_agent" }'
      ignore-invalid-headers: "false"
      enable-underscores-in-headers: "true"
      proxy-buffer-size: 64K
      allow-cross-namespace-resources: "true"
      strict-validate-path-type: "false"
      ssl-ciphers: "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384:AES128-GCM-SHA256:AES128-GCM-SHA384"
    extraArgs:
      default-ssl-certificate: $(POD_NAMESPACE)/default-ssl-certificate-selfsigned
      default-backend-service: $(POD_NAMESPACE)/$(OKTETO_INGRESS_NGINX_DEFAULT_BACKEND)
    service:
      externalTrafficPolicy: Local
      type: LoadBalancer
    ingressClass: okteto-controlplane-nginx
    ingressClassResource:
      name: okteto-controlplane-nginx
      enabled: true
      default: false
      controllerValue: "k8s.io/okteto-controlplane-nginx"
    extraEnvs:
      - name: OKTETO_INGRESS_NGINX_DEFAULT_BACKEND
        valueFrom:
          configMapKeyRef:
            key: defaultbackendservice
            name: okteto-ingress-config
    priorityClassName:
  defaultBackend:
    enabled: false`;

    const oldStr = content; // Same as content for this exact match test

    const newStr = `traefik:
  enabled: true
  ingressClass: okteto-controlplane-traefik
  ingressRoute:
    dashboard:
      enabled: false
  deployment:
    replicas: 2
  service:
    type: LoadBalancer
    externalTrafficPolicy: Local`;

    const result = performStringReplacement(content, oldStr, newStr);

    expect(result.success).toBe(true);
    expect(result.content).toBe(newStr);
  });

  it('handles case where oldStr is shorter than minimum fuzzy match length', () => {
    const content = 'Hello, world!';
    const oldStr = 'xyz'; // Too short for fuzzy matching
    const newStr = 'abc';

    const result = performStringReplacement(content, oldStr, newStr);

    expect(result.success).toBe(false);
    expect(result.content).toBe(content);
    expect(result.error).toBeDefined();
  });
});
