export const mockManifests = [
  {
    content: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: example-chart
  labels:
    app: example-chart
spec:
  replicas: 1
  selector:
    matchLabels:
      app: example-chart
  template:
    metadata:
      labels:
        app: example-chart
    spec:
      containers:
      - name: example-chart
        image: nginx:1.16.0
        ports:
        - containerPort: 80`
  },
  {
    content: `apiVersion: v1
kind: Service
metadata:
  name: example-chart
  labels:
    app: example-chart
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 80
protocol: TCP
  selector:
    app: example-chart`
  }
];