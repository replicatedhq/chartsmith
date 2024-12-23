// Mock Kubernetes manifests for testing
export const mockManifests = [
  {
    content: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-helm-chart
  labels:
    app: my-helm-chart
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-helm-chart
  template:
    metadata:
      labels:
        app: my-helm-chart
    spec:
      containers:
      - name: my-helm-chart
        image: nginx:1.16.0
        ports:
        - containerPort: 80`
  },
  {
    content: `apiVersion: v1
kind: Service
metadata:
  name: my-helm-chart
  labels:
    app: my-helm-chart
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 80
protocol: TCP
  selector:
    app: my-helm-chart`
  },
  {
    content: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-helm-chart
  labels:
    app: my-helm-chart
spec:
  rules:
  - http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: my-helm-chart
            port:
              number: 80`
  }
];