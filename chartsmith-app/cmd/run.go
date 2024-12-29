<<<<<<< SEARCH
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()

			sigChan := make(chan os.Signal, 1)
			signal.Notify(sigChan, syscall.SIGTERM, syscall.SIGINT)

			go func() {
				sig := <-sigChan
				fmt.Printf("Received signal %s, shutting down\n", sig)
				cancel()
			}()

			if err := listener.Run(ctx); err != nil {
				return errors.Wrap(err, "failed to run listener")
			}

			return nil
=======
			ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
			defer stop()

			if err := listener.Run(ctx); err != nil {
				return errors.Wrap(err, "failed to run listener")
			}

			return nil
>>>>>>> REPLACE
